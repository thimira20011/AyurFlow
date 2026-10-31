package patients

import (
	"context"
	"errors"
	"strings"
	"time"

	"ayurflow/backend/internal/audit"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrForbidden         = errors.New("patients: access denied")
	ErrNotFound          = errors.New("patients: not found")
	ErrStaleVersion      = errors.New("patients: stale version")
	ErrDuplicateIdentity = errors.New("patients: supplied identity already exists")
)

// AccessPolicy is supplied by AUTH-03. Every decision receives the same
// transaction as its protected database operation. A nil policy denies access.
type AccessPolicy interface {
	CanRegister(context.Context, pgx.Tx, string) error
	CanSearch(context.Context, pgx.Tx, string) error
	CanRead(context.Context, pgx.Tx, string, string) error
	CanEdit(context.Context, pgx.Tx, string, string, []string) error
}

type Patient struct {
	ID          string         `json:"id"`
	DisplayName string         `json:"displayName"`
	Phone       *string        `json:"phone"`
	Identity    *IdentityInput `json:"identity"`
	Version     int64          `json:"version"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}

// Optional values distinguish an omitted field from an explicit null (clear).
type OptionalString struct {
	Set   bool
	Value *string
}

type OptionalIdentity struct {
	Set   bool
	Value *IdentityInput
}

type UpdateInput struct {
	Version     int64
	DisplayName *string
	Phone       OptionalString
	Identity    OptionalIdentity
}

type Service struct {
	pool   *pgxpool.Pool
	access AccessPolicy
}

func NewService(pool *pgxpool.Pool, access AccessPolicy) *Service {
	return &Service{pool: pool, access: access}
}

func (s *Service) Create(ctx context.Context, actor string, input RegistrationInput) (Patient, error) {
	if !validUUID(actor) || ValidateRegistration(input) != nil {
		return Patient{}, ErrInvalidPatient
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Patient{}, ErrForbidden
	}
	var created Patient
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := s.access.CanRegister(ctx, tx, actor); err != nil {
			return err
		}
		var id string
		err := tx.QueryRow(ctx, `INSERT INTO patients(display_name, phone, created_by, updated_by)
			VALUES ($1, $2, $3, $3) RETURNING id::text`, input.DisplayName, input.Phone, actor).Scan(&id)
		if err != nil {
			return err
		}
		if input.Identity != nil {
			_, err = tx.Exec(ctx, `INSERT INTO patient_identities(patient_id, identity_type, original_value)
				VALUES ($1, $2, $3)`, id, input.Identity.Type, input.Identity.Value)
			if err != nil {
				return identityError(err)
			}
		}
		if err = audit.Write(ctx, tx, audit.Event{
			ActorID: actor, Action: "patient.created", Object: audit.Object{Type: "patient", ID: id},
		}); err != nil {
			return err
		}
		created, err = readPatient(ctx, tx, id)
		return err
	})
	return created, err
}

func (s *Service) Get(ctx context.Context, actor, id string) (Patient, error) {
	if !validUUID(actor) || !validUUID(id) {
		return Patient{}, ErrNotFound
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Patient{}, ErrForbidden
	}
	var patient Patient
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := s.access.CanRead(ctx, tx, actor, id); err != nil {
			return err
		}
		var err error
		patient, err = readPatient(ctx, tx, id)
		return err
	})
	return patient, err
}

// Search returns at most 25 visible summaries. It scans candidates in bounded
// batches and checks access before adding each result; no total or hidden ID is
// returned. More precise queries are needed when over 25 records match.
func (s *Service) Search(ctx context.Context, actor, query string) ([]Patient, error) {
	query = strings.TrimSpace(query)
	if !validUUID(actor) || query == "" || len(query) > 128 {
		return nil, ErrInvalidPatient
	}
	if s == nil || s.pool == nil || s.access == nil {
		return nil, ErrForbidden
	}
	canonical, _ := CanonicalIdentity(query)
	items := make([]Patient, 0, 25)
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := s.access.CanSearch(ctx, tx, actor); err != nil {
			return err
		}
		lastID := "00000000-0000-0000-0000-000000000000"
		for len(items) < 25 {
			rows, err := tx.Query(ctx, `SELECT p.id::text FROM patients p
				LEFT JOIN patient_identities i ON i.patient_id = p.id
				WHERE p.id > $3::uuid AND
				 (p.id::text = $1 OR strpos(lower(p.display_name), lower($1)) > 0
				 OR strpos(lower(coalesce(p.phone, '')), lower($1)) > 0
				 OR i.canonical_value = $2)
				ORDER BY p.id LIMIT 100`, query, canonical, lastID)
			if err != nil {
				return err
			}
			ids := make([]string, 0, 100)
			for rows.Next() {
				var id string
				if err := rows.Scan(&id); err != nil {
					rows.Close()
					return err
				}
				ids = append(ids, id)
			}
			err = rows.Err()
			rows.Close()
			if err != nil {
				return err
			}
			for _, id := range ids {
				lastID = id
				if err := s.access.CanRead(ctx, tx, actor, id); err != nil {
					if errors.Is(err, ErrForbidden) || errors.Is(err, ErrNotFound) {
						continue
					}
					return err
				}
				patient, err := readPatient(ctx, tx, id)
				if errors.Is(err, ErrNotFound) {
					continue
				}
				if err != nil {
					return err
				}
				items = append(items, patient)
				if len(items) == 25 {
					break
				}
			}
			if len(ids) < 100 {
				break
			}
		}
		return nil
	})
	return items, err
}

func validUUID(value string) bool {
	var id pgtype.UUID
	return id.Scan(value) == nil && id.Valid && id.Bytes != [16]byte{}
}
