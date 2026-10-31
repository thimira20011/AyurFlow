package consultations

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"ayurflow/backend/internal/audit"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrForbidden       = errors.New("consultations: access denied")
	ErrNotFound        = errors.New("consultations: not found")
	ErrInvalidDraft    = errors.New("consultations: invalid draft")
	ErrStaleVersion    = errors.New("consultations: stale version")
	ErrNotDraft        = errors.New("consultations: no longer a draft")
	ErrNotSigned       = errors.New("consultations: not signed")
	ErrInvalidAddendum = errors.New("consultations: invalid addendum")
)

// AccessPolicy must check an active clinician's patient assignment in the
// caller's transaction. No policy, including a nil policy, grants access.
// Assignment grant authority and final access policy remain DEC02 review gates.
type AccessPolicy interface {
	CanCreate(context.Context, pgx.Tx, string, string) error
	CanList(context.Context, pgx.Tx, string, string) error
	CanRead(context.Context, pgx.Tx, string, string, string) error
	CanEdit(context.Context, pgx.Tx, string, string, string) error
}

type Consultation struct {
	ID         string     `json:"id"`
	PatientID  string     `json:"patientId"`
	Status     string     `json:"status"`
	DraftText  string     `json:"draftText,omitempty"`
	SignedText string     `json:"signedText,omitempty"`
	SignedBy   string     `json:"signedBy,omitempty"`
	SignedAt   *time.Time `json:"signedAt,omitempty"`
	Addenda    []Addendum `json:"addenda,omitempty"`
	Version    int64      `json:"version"`
	CreatedAt  time.Time  `json:"createdAt"`
	CreatedBy  string     `json:"createdBy"`
	UpdatedAt  time.Time  `json:"updatedAt"`
	UpdatedBy  string     `json:"updatedBy"`
}

type Addendum struct {
	ID             string    `json:"id"`
	ConsultationID string    `json:"consultationId"`
	AuthorID       string    `json:"authorId"`
	CreatedAt      time.Time `json:"createdAt"`
	Reason         string    `json:"reason"`
	Body           string    `json:"body"`
}

// Summary deliberately omits all clinical text and correction reasons.
type Summary struct {
	ID        string     `json:"id"`
	PatientID string     `json:"patientId"`
	Status    string     `json:"status"`
	Version   int64      `json:"version"`
	CreatedAt time.Time  `json:"createdAt"`
	CreatedBy string     `json:"createdBy"`
	SignedAt  *time.Time `json:"signedAt,omitempty"`
}

type Service struct {
	pool   *pgxpool.Pool
	access AccessPolicy
}

func NewService(pool *pgxpool.Pool, access AccessPolicy) *Service {
	return &Service{pool: pool, access: access}
}

func (s *Service) List(ctx context.Context, actor, patientID string) ([]Summary, error) {
	if !validUUID(actor) {
		return nil, ErrForbidden
	}
	if !validUUID(patientID) {
		return nil, ErrNotFound
	}
	if s == nil || s.pool == nil || s.access == nil {
		return nil, ErrForbidden
	}
	items := make([]Summary, 0)
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := s.access.CanList(ctx, tx, actor, patientID); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `SELECT id::text, patient_id::text, status,
			record_version, created_at, created_by::text, signed_at
			FROM consultations WHERE patient_id=$1
			ORDER BY created_at DESC, id DESC LIMIT 25`, patientID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var item Summary
			if err := rows.Scan(&item.ID, &item.PatientID, &item.Status,
				&item.Version, &item.CreatedAt, &item.CreatedBy, &item.SignedAt); err != nil {
				return err
			}
			items = append(items, item)
		}
		return rows.Err()
	})
	return items, err
}

// GetByID resolves the immutable patient link and checks access before reading
// any note body. It supports the single-ID detail route used by the client.
func (s *Service) GetByID(ctx context.Context, actor, id string) (Consultation, error) {
	if !validUUID(actor) {
		return Consultation{}, ErrForbidden
	}
	if !validUUID(id) {
		return Consultation{}, ErrNotFound
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Consultation{}, ErrForbidden
	}
	var found Consultation
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		patientID, err := consultationPatientID(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := s.access.CanRead(ctx, tx, actor, patientID, id); err != nil {
			return err
		}
		found, err = readConsultation(ctx, tx, patientID, id)
		return err
	})
	return found, err
}

// UpdateByID resolves the patient link before invoking the versioned service
// transaction. Patient IDs on consultations have no application update path.
func (s *Service) UpdateByID(ctx context.Context, actor, id string, version int64, draftText string) (Consultation, error) {
	if !validUUID(actor) {
		return Consultation{}, ErrForbidden
	}
	if !validUUID(id) {
		return Consultation{}, ErrNotFound
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Consultation{}, ErrForbidden
	}
	var patientID string
	err := s.pool.QueryRow(ctx, `SELECT patient_id::text FROM consultations WHERE id=$1`, id).Scan(&patientID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Consultation{}, ErrNotFound
	}
	if err != nil {
		return Consultation{}, err
	}
	return s.Update(ctx, actor, patientID, id, version, draftText)
}

func (s *Service) Create(ctx context.Context, actor, patientID, draftText string) (Consultation, error) {
	if !validUUID(actor) {
		return Consultation{}, ErrForbidden
	}
	if !validUUID(patientID) {
		return Consultation{}, ErrNotFound
	}
	if !validDraft(draftText) {
		return Consultation{}, ErrInvalidDraft
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Consultation{}, ErrForbidden
	}
	var created Consultation
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := s.access.CanCreate(ctx, tx, actor, patientID); err != nil {
			return err
		}
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM patients WHERE id=$1)`, patientID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return ErrNotFound
		}
		var id string
		if err := tx.QueryRow(ctx, `INSERT INTO consultations(patient_id, draft_text, created_by, updated_by)
			VALUES ($1, $2, $3, $3) RETURNING id::text`, patientID, draftText, actor).Scan(&id); err != nil {
			return err
		}
		if err := audit.Write(ctx, tx, audit.Event{
			ActorID: actor, Action: "consultation.created",
			Object: audit.Object{Type: "consultation", ID: id},
		}); err != nil {
			return err
		}
		var err error
		created, err = readConsultation(ctx, tx, patientID, id)
		return err
	})
	return created, err
}

func (s *Service) Get(ctx context.Context, actor, patientID, id string) (Consultation, error) {
	if !validUUID(actor) {
		return Consultation{}, ErrForbidden
	}
	if !validUUID(patientID) || !validUUID(id) {
		return Consultation{}, ErrNotFound
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Consultation{}, ErrForbidden
	}
	var found Consultation
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := s.access.CanRead(ctx, tx, actor, patientID, id); err != nil {
			return err
		}
		var err error
		found, err = readConsultation(ctx, tx, patientID, id)
		return err
	})
	return found, err
}

func (s *Service) Update(ctx context.Context, actor, patientID, id string, version int64, draftText string) (Consultation, error) {
	if !validUUID(actor) {
		return Consultation{}, ErrForbidden
	}
	if !validUUID(patientID) || !validUUID(id) {
		return Consultation{}, ErrNotFound
	}
	if version <= 0 || !validDraft(draftText) {
		return Consultation{}, ErrInvalidDraft
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Consultation{}, ErrForbidden
	}
	var updated Consultation
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := s.access.CanEdit(ctx, tx, actor, patientID, id); err != nil {
			return err
		}
		var currentVersion int64
		var status string
		err := tx.QueryRow(ctx, `SELECT record_version, status FROM consultations
			WHERE id=$1 AND patient_id=$2 FOR UPDATE`, id, patientID).Scan(&currentVersion, &status)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if status != "draft" {
			return ErrNotDraft
		}
		if currentVersion != version {
			return ErrStaleVersion
		}
		if _, err := tx.Exec(ctx, `UPDATE consultations SET draft_text=$3,
			record_version=record_version+1, updated_at=clock_timestamp(), updated_by=$4
			WHERE id=$1 AND patient_id=$2`, id, patientID, draftText, actor); err != nil {
			return err
		}
		if err := audit.Write(ctx, tx, audit.Event{
			ActorID: actor, Action: "consultation.updated",
			Object:        audit.Object{Type: "consultation", ID: id},
			ChangedFields: []string{"draft_text"},
		}); err != nil {
			return err
		}
		updated, err = readConsultation(ctx, tx, patientID, id)
		return err
	})
	return updated, err
}

// Sign freezes the current draft as the original signed record. A concurrent
// edit or signature with the same version loses after the row lock.
func (s *Service) Sign(ctx context.Context, actor, patientID, id string, version int64) (Consultation, error) {
	if !validUUID(actor) {
		return Consultation{}, ErrForbidden
	}
	if !validUUID(patientID) || !validUUID(id) {
		return Consultation{}, ErrNotFound
	}
	if version <= 0 {
		return Consultation{}, ErrStaleVersion
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Consultation{}, ErrForbidden
	}
	var signed Consultation
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := s.access.CanEdit(ctx, tx, actor, patientID, id); err != nil {
			return err
		}
		var currentVersion int64
		var status string
		err := tx.QueryRow(ctx, `SELECT record_version, status FROM consultations
			WHERE id=$1 AND patient_id=$2 FOR UPDATE`, id, patientID).Scan(&currentVersion, &status)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if status != "draft" {
			return ErrNotDraft
		}
		if currentVersion != version {
			return ErrStaleVersion
		}
		_, err = tx.Exec(ctx, `UPDATE consultations SET status='signed', signed_text=draft_text,
			draft_text=NULL, signed_by=$3, signed_at=clock_timestamp(),
			record_version=record_version+1, updated_at=clock_timestamp(), updated_by=$3
			WHERE id=$1 AND patient_id=$2`, id, patientID, actor)
		if err != nil {
			return err
		}
		if err := audit.Write(ctx, tx, audit.Event{
			ActorID: actor, Action: "consultation.signed",
			Object:        audit.Object{Type: "consultation", ID: id},
			ChangedFields: []string{"status", "signed_text", "signed_by", "signed_at"},
		}); err != nil {
			return err
		}
		signed, err = readConsultation(ctx, tx, patientID, id)
		return err
	})
	return signed, err
}

func (s *Service) SignByID(ctx context.Context, actor, id string, version int64) (Consultation, error) {
	if !validUUID(actor) {
		return Consultation{}, ErrForbidden
	}
	if !validUUID(id) {
		return Consultation{}, ErrNotFound
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Consultation{}, ErrForbidden
	}
	var patientID string
	err := s.pool.QueryRow(ctx, `SELECT patient_id::text FROM consultations WHERE id=$1`, id).Scan(&patientID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Consultation{}, ErrNotFound
	}
	if err != nil {
		return Consultation{}, err
	}
	return s.Sign(ctx, actor, patientID, id, version)
}

// AddCorrection appends a separately dated correction without changing the
// signed original. Reason and body are kept in the clinical table, not audit.
func (s *Service) AddCorrection(ctx context.Context, actor, patientID, id, reason, body string) (Addendum, error) {
	if !validUUID(actor) {
		return Addendum{}, ErrForbidden
	}
	if !validUUID(patientID) || !validUUID(id) {
		return Addendum{}, ErrNotFound
	}
	if !validReason(reason) || !validDraft(body) {
		return Addendum{}, ErrInvalidAddendum
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Addendum{}, ErrForbidden
	}
	var added Addendum
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := s.access.CanEdit(ctx, tx, actor, patientID, id); err != nil {
			return err
		}
		var status string
		err := tx.QueryRow(ctx, `SELECT status FROM consultations
			WHERE id=$1 AND patient_id=$2 FOR UPDATE`, id, patientID).Scan(&status)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if status != "signed" {
			return ErrNotSigned
		}
		err = tx.QueryRow(ctx, `INSERT INTO consultation_addenda(consultation_id,author_id,reason,body)
			VALUES ($1,$2,$3,$4) RETURNING id::text, consultation_id::text,
			author_id::text, created_at, reason, body`, id, actor, reason, body).Scan(
			&added.ID, &added.ConsultationID, &added.AuthorID, &added.CreatedAt, &added.Reason, &added.Body,
		)
		if err != nil {
			return err
		}
		return audit.Write(ctx, tx, audit.Event{
			ActorID: actor, Action: "consultation.addendum_created",
			Object: audit.Object{Type: "consultation_addendum", ID: added.ID},
		})
	})
	return added, err
}

func (s *Service) AddCorrectionByID(ctx context.Context, actor, id, reason, body string) (Addendum, error) {
	if !validUUID(actor) {
		return Addendum{}, ErrForbidden
	}
	if !validUUID(id) {
		return Addendum{}, ErrNotFound
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Addendum{}, ErrForbidden
	}
	var patientID string
	err := s.pool.QueryRow(ctx, `SELECT patient_id::text FROM consultations WHERE id=$1`, id).Scan(&patientID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Addendum{}, ErrNotFound
	}
	if err != nil {
		return Addendum{}, err
	}
	return s.AddCorrection(ctx, actor, patientID, id, reason, body)
}

func validDraft(value string) bool {
	return utf8.ValidString(value) && len(value) <= 65536 && strings.TrimSpace(value) != ""
}

func validReason(value string) bool {
	return utf8.ValidString(value) && len(value) <= 2048 && strings.TrimSpace(value) != ""
}

func validUUID(value string) bool {
	var id pgtype.UUID
	return id.Scan(value) == nil && id.Valid && id.Bytes != [16]byte{}
}
