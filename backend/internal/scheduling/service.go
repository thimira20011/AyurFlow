package scheduling

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"ayurflow/backend/internal/audit"
	"ayurflow/backend/internal/clinical"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrForbidden  = errors.New("scheduling: forbidden")
	ErrNotFound   = errors.New("scheduling: not found")
	ErrConflict   = errors.New("scheduling: conflict")
	ErrValidation = errors.New("scheduling: invalid request")
)

type Room struct {
	ID     string `json:"id"`
	Code   string `json:"code"`
	Name   string `json:"name"`
	Active bool   `json:"active"`
}

type Availability struct {
	ID          string    `json:"id"`
	RoomID      *string   `json:"roomId"`
	TherapistID *string   `json:"therapistId"`
	StartsAt    time.Time `json:"startsAt"`
	EndsAt      time.Time `json:"endsAt"`
}

type Session struct {
	ID                 string    `json:"id"`
	PatientID          string    `json:"patientId"`
	PlanID             string    `json:"planId"`
	StageID            string    `json:"stageId"`
	RoomID             string    `json:"roomId"`
	TherapistID        string    `json:"therapistId"`
	StartsAt           time.Time `json:"startsAt"`
	EndsAt             time.Time `json:"endsAt"`
	Status             string    `json:"status"`
	Observations       *string   `json:"observations"`
	CancellationReason *string   `json:"cancellationReason"`
	Version            int64     `json:"version"`
}

type BookRequest struct {
	PatientID   string    `json:"patientId"`
	PlanID      string    `json:"planId"`
	StageID     string    `json:"stageId"`
	RoomID      string    `json:"roomId"`
	TherapistID string    `json:"therapistId"`
	StartsAt    time.Time `json:"startsAt"`
	EndsAt      time.Time `json:"endsAt"`
}

type RescheduleRequest struct {
	RoomID      string    `json:"roomId"`
	TherapistID string    `json:"therapistId"`
	StartsAt    time.Time `json:"startsAt"`
	EndsAt      time.Time `json:"endsAt"`
	Version     int64     `json:"version"`
}

type Service struct{ Pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{Pool: pool} }

func validUUID(value string) bool {
	var id pgtype.UUID
	return id.Scan(value) == nil && id.Valid && id.Bytes != [16]byte{}
}

func validWindow(start, end time.Time) bool {
	return !start.IsZero() && end.After(start) && end.Sub(start) <= 24*time.Hour && start.After(time.Now().Add(-time.Minute))
}

func requireRole(ctx context.Context, tx pgx.Tx, actor string, roles ...string) error {
	if !validUUID(actor) {
		return ErrForbidden
	}
	var active bool
	if err := tx.QueryRow(ctx, `SELECT active FROM staff_accounts WHERE id=$1 FOR SHARE`, actor).Scan(&active); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrForbidden
		}
		return err
	}
	if !active {
		return ErrForbidden
	}
	for _, role := range roles {
		var held string
		err := tx.QueryRow(ctx, `SELECT role_code FROM staff_roles WHERE staff_id=$1 AND role_code=$2 FOR SHARE`, actor, role).Scan(&held)
		if err == nil {
			return nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
	}
	return ErrForbidden
}

func safeError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23P01", "23505", "23514":
			return ErrConflict
		case "23503":
			return ErrNotFound
		}
	}
	return err
}

func scanSession(row pgx.Row) (Session, error) {
	var s Session
	err := row.Scan(&s.ID, &s.PatientID, &s.PlanID, &s.StageID, &s.RoomID, &s.TherapistID,
		&s.StartsAt, &s.EndsAt, &s.Status, &s.Observations, &s.CancellationReason, &s.Version)
	return s, err
}

const sessionColumns = `id::text,patient_id::text,plan_id::text,stage_id::text,room_id::text,therapist_id::text,
	starts_at,ends_at,status,observations,cancellation_reason,record_version`

func (s *Service) CreateRoom(ctx context.Context, actor, code, name string) (Room, error) {
	code, name = strings.TrimSpace(code), strings.TrimSpace(name)
	if len(code) == 0 || len(code) > 64 || len(name) == 0 || len(name) > 120 || !utf8.ValidString(name) {
		return Room{}, ErrValidation
	}
	var room Room
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := requireRole(ctx, tx, actor, "receptionist"); err != nil {
			return err
		}
		if err := tx.QueryRow(ctx, `INSERT INTO clinic_rooms(code,name,created_by) VALUES ($1,$2,$3)
			RETURNING id::text,code,name,active`, code, name, actor).Scan(&room.ID, &room.Code, &room.Name, &room.Active); err != nil {
			return safeError(err)
		}
		return audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "room.created", Object: audit.Object{Type: "clinic_room", ID: room.ID}})
	})
	return room, err
}

func (s *Service) ListRooms(ctx context.Context, actor string) ([]Room, error) {
	var result []Room
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := requireRole(ctx, tx, actor, "receptionist", "therapist", "clinician"); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `SELECT id::text,code,name,active FROM clinic_rooms WHERE active ORDER BY code LIMIT 100`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var room Room
			if err := rows.Scan(&room.ID, &room.Code, &room.Name, &room.Active); err != nil {
				return err
			}
			result = append(result, room)
		}
		return rows.Err()
	})
	return result, err
}

func (s *Service) AddAvailability(ctx context.Context, actor string, roomID, therapistID *string, start, end time.Time) (Availability, error) {
	if !validWindow(start, end) || (roomID == nil) == (therapistID == nil) {
		return Availability{}, ErrValidation
	}
	if roomID != nil && !validUUID(*roomID) || therapistID != nil && !validUUID(*therapistID) {
		return Availability{}, ErrValidation
	}
	var out Availability
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := requireRole(ctx, tx, actor, "receptionist"); err != nil {
			return err
		}
		if roomID != nil {
			var active bool
			if err := tx.QueryRow(ctx, `SELECT active FROM clinic_rooms WHERE id=$1 FOR SHARE`, *roomID).Scan(&active); err != nil || !active {
				return ErrNotFound
			}
		} else {
			if err := requireRole(ctx, tx, *therapistID, "therapist"); err != nil {
				return ErrNotFound
			}
		}
		if err := tx.QueryRow(ctx, `INSERT INTO resource_availability(room_id,therapist_id,starts_at,ends_at,created_by)
			VALUES ($1,$2,$3,$4,$5) RETURNING id::text,room_id::text,therapist_id::text,starts_at,ends_at`,
			roomID, therapistID, start.UTC(), end.UTC(), actor).Scan(&out.ID, &out.RoomID, &out.TherapistID, &out.StartsAt, &out.EndsAt); err != nil {
			return safeError(err)
		}
		return audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "availability.created", Object: audit.Object{Type: "availability", ID: out.ID}})
	})
	return out, err
}

// ChangeAvailability preserves coverage for every booked or running session.
// Booking takes share locks on the covering windows, so it cannot race this edit.
func (s *Service) ChangeAvailability(ctx context.Context, actor, id string, start, end time.Time) (Availability, error) {
	if !validUUID(id) || !validWindow(start, end) {
		return Availability{}, ErrValidation
	}
	var out Availability
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := requireRole(ctx, tx, actor, "receptionist"); err != nil {
			return err
		}
		err := tx.QueryRow(ctx, `SELECT id::text,room_id::text,therapist_id::text,starts_at,ends_at
			FROM resource_availability WHERE id=$1 FOR UPDATE`, id).Scan(&out.ID, &out.RoomID, &out.TherapistID, &out.StartsAt, &out.EndsAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		var uncovered bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM therapy_sessions t
			WHERE t.status IN ('booked','in_progress')
			AND (($1::uuid IS NOT NULL AND t.room_id=$1) OR ($2::uuid IS NOT NULL AND t.therapist_id=$2))
			AND NOT ($3 <= t.starts_at AND $4 >= t.ends_at)
			AND NOT EXISTS(SELECT 1 FROM resource_availability a WHERE a.id <> $5
				AND (($1::uuid IS NOT NULL AND a.room_id=$1) OR ($2::uuid IS NOT NULL AND a.therapist_id=$2))
				AND a.starts_at <= t.starts_at AND a.ends_at >= t.ends_at))`,
			out.RoomID, out.TherapistID, start.UTC(), end.UTC(), id).Scan(&uncovered)
		if err != nil {
			return err
		}
		if uncovered {
			return ErrConflict
		}
		if err := tx.QueryRow(ctx, `UPDATE resource_availability SET starts_at=$2,ends_at=$3 WHERE id=$1
			RETURNING id::text,room_id::text,therapist_id::text,starts_at,ends_at`, id, start.UTC(), end.UTC()).Scan(
			&out.ID, &out.RoomID, &out.TherapistID, &out.StartsAt, &out.EndsAt); err != nil {
			return err
		}
		return audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "availability.changed", Object: audit.Object{Type: "availability", ID: id}, ChangedFields: []string{"starts_at", "ends_at"}})
	})
	return out, err
}

func (s *Service) ListAvailability(ctx context.Context, actor string, start, end time.Time) ([]Availability, error) {
	if !end.After(start) || end.Sub(start) > 31*24*time.Hour {
		return nil, ErrValidation
	}
	var result []Availability
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := requireRole(ctx, tx, actor, "receptionist", "therapist", "clinician"); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `SELECT id::text,room_id::text,therapist_id::text,starts_at,ends_at
			FROM resource_availability WHERE starts_at < $2 AND ends_at > $1 ORDER BY starts_at,id LIMIT 200`, start.UTC(), end.UTC())
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var item Availability
			if err := rows.Scan(&item.ID, &item.RoomID, &item.TherapistID, &item.StartsAt, &item.EndsAt); err != nil {
				return err
			}
			result = append(result, item)
		}
		return rows.Err()
	})
	return result, err
}

func checkBooking(ctx context.Context, tx pgx.Tx, patientID, planID, stageID, roomID, therapistID string, start, end time.Time) error {
	var planStatus, stageStatus string
	var current, ordinal int
	err := tx.QueryRow(ctx, `SELECT p.status,p.current_stage_ordinal,s.status,s.ordinal FROM care_plans p
		JOIN plan_stages s ON s.plan_id=p.id WHERE p.id=$1 AND p.patient_id=$2 AND s.id=$3 FOR SHARE OF p,s`,
		planID, patientID, stageID).Scan(&planStatus, &current, &stageStatus, &ordinal)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if planStatus != "active" || current != ordinal || stageStatus != "approved" {
		return ErrConflict
	}
	var active bool
	if err := tx.QueryRow(ctx, `SELECT active FROM clinic_rooms WHERE id=$1 FOR SHARE`, roomID).Scan(&active); err != nil || !active {
		return ErrConflict
	}
	for _, resource := range []struct{ column, id string }{{"room_id", roomID}, {"therapist_id", therapistID}} {
		var covering string
		err := tx.QueryRow(ctx, `SELECT id::text FROM resource_availability WHERE `+resource.column+`=$1
			AND starts_at <= $2 AND ends_at >= $3 ORDER BY id LIMIT 1 FOR SHARE`, resource.id, start.UTC(), end.UTC()).Scan(&covering)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrConflict
		}
		if err != nil {
			return err
		}
	}
	return requireRole(ctx, tx, therapistID, "therapist")
}

func (s *Service) Book(ctx context.Context, actor string, req BookRequest) (Session, error) {
	if !validUUID(req.PatientID) || !validUUID(req.PlanID) || !validUUID(req.StageID) || !validUUID(req.RoomID) || !validUUID(req.TherapistID) || !validWindow(req.StartsAt, req.EndsAt) {
		return Session{}, ErrValidation
	}
	var result Session
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := requireRole(ctx, tx, actor, "receptionist"); err != nil {
			return err
		}
		if err := checkBooking(ctx, tx, req.PatientID, req.PlanID, req.StageID, req.RoomID, req.TherapistID, req.StartsAt, req.EndsAt); err != nil {
			return err
		}
		row := tx.QueryRow(ctx, `INSERT INTO therapy_sessions(patient_id,plan_id,stage_id,room_id,therapist_id,starts_at,ends_at,created_by,updated_by)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING `+sessionColumns,
			req.PatientID, req.PlanID, req.StageID, req.RoomID, req.TherapistID, req.StartsAt.UTC(), req.EndsAt.UTC(), actor)
		var err error
		result, err = scanSession(row)
		if err != nil {
			return safeError(err)
		}
		return audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "session.booked", Object: audit.Object{Type: "therapy_session", ID: result.ID}})
	})
	return result, err
}

func (s *Service) ListSessions(ctx context.Context, actor string, start, end time.Time) ([]Session, error) {
	if !end.After(start) || end.Sub(start) > 31*24*time.Hour {
		return nil, ErrValidation
	}
	var result []Session
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		role := "receptionist"
		if err := requireRole(ctx, tx, actor, role); err != nil {
			if !errors.Is(err, ErrForbidden) {
				return err
			}
			role = "therapist"
			if err := requireRole(ctx, tx, actor, role); err != nil {
				if !errors.Is(err, ErrForbidden) {
					return err
				}
				role = "clinician"
				if err := requireRole(ctx, tx, actor, role); err != nil {
					return err
				}
			}
		}
		rows, err := tx.Query(ctx, `SELECT `+sessionColumns+` FROM therapy_sessions
			WHERE starts_at < $2 AND ends_at > $1 AND ($3='receptionist' OR
			($3='therapist' AND therapist_id=$4) OR
			($3='clinician' AND EXISTS(SELECT 1 FROM patient_clinician_assignments a
				WHERE a.patient_id=therapy_sessions.patient_id AND a.clinician_id=$4 AND a.revoked_at IS NULL)))
			ORDER BY starts_at,id LIMIT 200`, start.UTC(), end.UTC(), role, actor)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			item, err := scanSession(rows)
			if err != nil {
				return err
			}
			// Reception needs booking details without clinical delivery observations.
			if role == "receptionist" {
				item.Observations = nil
			}
			result = append(result, item)
		}
		return rows.Err()
	})
	return result, err
}

func (s *Service) Reschedule(ctx context.Context, actor, id string, req RescheduleRequest) (Session, error) {
	if !validUUID(id) || !validUUID(req.RoomID) || !validUUID(req.TherapistID) || !validWindow(req.StartsAt, req.EndsAt) || req.Version < 1 {
		return Session{}, ErrValidation
	}
	var result Session
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := requireRole(ctx, tx, actor, "receptionist"); err != nil {
			return err
		}
		// Plan lock precedes the session lock, matching hold/cancel and start.
		preview, err := scanSession(tx.QueryRow(ctx, `SELECT `+sessionColumns+` FROM therapy_sessions WHERE id=$1`, id))
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if err := checkBooking(ctx, tx, preview.PatientID, preview.PlanID, preview.StageID, req.RoomID, req.TherapistID, req.StartsAt, req.EndsAt); err != nil {
			return err
		}
		current, err := scanSession(tx.QueryRow(ctx, `SELECT `+sessionColumns+` FROM therapy_sessions WHERE id=$1 FOR UPDATE`, id))
		if err != nil {
			return err
		}
		if current.PlanID != preview.PlanID || current.StageID != preview.StageID || current.Status != "booked" || current.Version != req.Version || !current.StartsAt.After(time.Now()) {
			return ErrConflict
		}
		result, err = scanSession(tx.QueryRow(ctx, `UPDATE therapy_sessions SET room_id=$2,therapist_id=$3,starts_at=$4,ends_at=$5,
			record_version=record_version+1,updated_by=$6,updated_at=clock_timestamp() WHERE id=$1 RETURNING `+sessionColumns,
			id, req.RoomID, req.TherapistID, req.StartsAt.UTC(), req.EndsAt.UTC(), actor))
		if err != nil {
			return safeError(err)
		}
		return audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "session.rescheduled", Object: audit.Object{Type: "therapy_session", ID: id}, ChangedFields: []string{"room_id", "therapist_id", "starts_at", "ends_at"}})
	})
	return result, err
}

func (s *Service) Start(ctx context.Context, actor, id string) (Session, error) {
	if !validUUID(id) {
		return Session{}, ErrValidation
	}
	var result Session
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := requireRole(ctx, tx, actor, "therapist"); err != nil {
			return err
		}
		var planID, stageID string
		if err := tx.QueryRow(ctx, `SELECT plan_id::text,stage_id::text FROM therapy_sessions WHERE id=$1`, id).Scan(&planID, &stageID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNotFound
			}
			return err
		}
		if err := clinical.RequireSessionClearance(ctx, tx, planID, stageID); err != nil {
			return ErrConflict
		}
		current, err := scanSession(tx.QueryRow(ctx, `SELECT `+sessionColumns+` FROM therapy_sessions WHERE id=$1 FOR UPDATE`, id))
		if err != nil {
			return err
		}
		if current.PlanID != planID || current.StageID != stageID || current.TherapistID != actor {
			return ErrForbidden
		}
		if current.Status != "booked" {
			return ErrConflict
		}
		result, err = scanSession(tx.QueryRow(ctx, `UPDATE therapy_sessions SET status='in_progress',started_at=clock_timestamp(),
			record_version=record_version+1,updated_by=$2,updated_at=clock_timestamp() WHERE id=$1 RETURNING `+sessionColumns, id, actor))
		if err != nil {
			return err
		}
		return audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "session.started", Object: audit.Object{Type: "therapy_session", ID: id}})
	})
	return result, err
}

func (s *Service) Complete(ctx context.Context, actor, id, observations string) (Session, error) {
	if !validUUID(id) {
		return Session{}, ErrValidation
	}
	observations = strings.TrimSpace(observations)
	if observations == "" || len(observations) > 8000 || !utf8.ValidString(observations) {
		return Session{}, ErrValidation
	}
	var result Session
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := requireRole(ctx, tx, actor, "therapist"); err != nil {
			return err
		}
		current, err := scanSession(tx.QueryRow(ctx, `SELECT `+sessionColumns+` FROM therapy_sessions WHERE id=$1 FOR UPDATE`, id))
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if current.TherapistID != actor {
			return ErrForbidden
		}
		if current.Status != "in_progress" {
			return ErrConflict
		}
		result, err = scanSession(tx.QueryRow(ctx, `UPDATE therapy_sessions SET status='completed',observations=$2,completed_at=clock_timestamp(),
			record_version=record_version+1,updated_by=$3,updated_at=clock_timestamp() WHERE id=$1 RETURNING `+sessionColumns, id, observations, actor))
		if err != nil {
			return err
		}
		return audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "session.completed", Object: audit.Object{Type: "therapy_session", ID: id}, ChangedFields: []string{"status", "observations"}})
	})
	return result, err
}

func (s *Service) Cancel(ctx context.Context, actor, id, reason string) (Session, error) {
	if !validUUID(id) {
		return Session{}, ErrValidation
	}
	reason = strings.TrimSpace(reason)
	if reason == "" || len(reason) > 1000 || !utf8.ValidString(reason) {
		return Session{}, ErrValidation
	}
	var result Session
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := requireRole(ctx, tx, actor, "receptionist"); err != nil {
			return err
		}
		current, err := scanSession(tx.QueryRow(ctx, `SELECT `+sessionColumns+` FROM therapy_sessions WHERE id=$1 FOR UPDATE`, id))
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if current.Status != "booked" {
			return ErrConflict
		}
		result, err = scanSession(tx.QueryRow(ctx, `UPDATE therapy_sessions SET status='cancelled',cancellation_reason=$2,cancelled_at=clock_timestamp(),
			record_version=record_version+1,updated_by=$3,updated_at=clock_timestamp() WHERE id=$1 RETURNING `+sessionColumns, id, reason, actor))
		if err != nil {
			return err
		}
		return audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "session.cancelled", Object: audit.Object{Type: "therapy_session", ID: id}, ReasonCode: "booking_cancelled"})
	})
	return result, err
}

// CanComplete is called with the plan row locked by the clinical service.
// Every stage requires delivered-session evidence and no unfinished session.
// Empty-stage completion remains gated pending clinic review.
func (s *Service) CanComplete(ctx context.Context, tx pgx.Tx, planID, stageID string) error {
	var ordinal int
	if err := tx.QueryRow(ctx, `SELECT ordinal FROM plan_stages WHERE id=$1 AND plan_id=$2`, stageID, planID).Scan(&ordinal); err != nil {
		return clinical.ErrCompletionPending
	}
	var completed, pending int
	if err := tx.QueryRow(ctx, `SELECT count(*) FILTER (WHERE status='completed'),
		count(*) FILTER (WHERE status IN ('booked','in_progress')) FROM therapy_sessions
		WHERE plan_id=$1 AND stage_id=$2`, planID, stageID).Scan(&completed, &pending); err != nil {
		return err
	}
	if pending != 0 || completed == 0 {
		return clinical.ErrCompletionPending
	}
	var unconsumed bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM preparations p JOIN therapy_sessions t ON t.id=p.session_id
		WHERE t.plan_id=$1 AND t.stage_id=$2 AND p.status='prepared')`, planID, stageID).Scan(&unconsumed); err != nil {
		return err
	}
	if unconsumed {
		return clinical.ErrCompletionPending
	}
	return nil
}

// CancelFuture participates in the caller's plan transaction after its plan lock.
// Started and completed delivery stays immutable; only future booked sessions change.
func (s *Service) CancelFuture(ctx context.Context, tx pgx.Tx, planID, actor string) error {
	rows, err := tx.Query(ctx, `SELECT id::text FROM therapy_sessions
		WHERE plan_id=$1 AND status='booked' AND starts_at > clock_timestamp() ORDER BY id FOR UPDATE`, planID)
	if err != nil {
		return err
	}
	var ids []string
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
		if _, err := tx.Exec(ctx, `UPDATE therapy_sessions SET status='cancelled',cancellation_reason='Care plan cancelled',
			cancelled_at=clock_timestamp(),record_version=record_version+1,updated_by=$2,updated_at=clock_timestamp() WHERE id=$1`, id, actor); err != nil {
			return err
		}
		if err := audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "session.cancelled", Object: audit.Object{Type: "therapy_session", ID: id}, ReasonCode: "plan_cancelled"}); err != nil {
			return err
		}
	}
	return nil
}
