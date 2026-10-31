package consultations

import (
	"context"
	"errors"

	"ayurflow/backend/internal/audit"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrAssignmentConflict = errors.New("consultations: active assignment already exists")

// AssignmentService lets an active administrator manage patient/clinician links
// without granting that administrator access to consultation bodies.
type AssignmentService struct{ pool *pgxpool.Pool }

func NewAssignmentService(pool *pgxpool.Pool) *AssignmentService {
	return &AssignmentService{pool: pool}
}

func (s *AssignmentService) Grant(ctx context.Context, actor, patientID, clinicianID string) (string, error) {
	if !validUUID(actor) {
		return "", ErrForbidden
	}
	if !validUUID(patientID) || !validUUID(clinicianID) {
		return "", ErrNotFound
	}
	if s == nil || s.pool == nil {
		return "", ErrForbidden
	}
	var assignmentID string
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := requireAssignmentAdmin(ctx, tx, actor); err != nil {
			return err
		}
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM patients WHERE id=$1)`, patientID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return ErrNotFound
		}
		if err := requireActiveClinician(ctx, tx, clinicianID); err != nil {
			return err
		}
		err := tx.QueryRow(ctx, `INSERT INTO patient_clinician_assignments(patient_id,clinician_id,granted_by)
			VALUES ($1,$2,$3) RETURNING id::text`, patientID, clinicianID, actor).Scan(&assignmentID)
		if err != nil {
			var dbErr *pgconn.PgError
			if errors.As(err, &dbErr) && dbErr.Code == "23505" && dbErr.ConstraintName == "patient_clinician_active_unique" {
				return ErrAssignmentConflict
			}
			return err
		}
		return audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "clinical_assignment.granted",
			Object: audit.Object{Type: "patient_clinician_assignment", ID: assignmentID}})
	})
	return assignmentID, err
}

func (s *AssignmentService) Revoke(ctx context.Context, actor, patientID, clinicianID string) error {
	if !validUUID(actor) {
		return ErrForbidden
	}
	if !validUUID(patientID) || !validUUID(clinicianID) {
		return ErrNotFound
	}
	if s == nil || s.pool == nil {
		return ErrForbidden
	}
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := requireAssignmentAdmin(ctx, tx, actor); err != nil {
			return err
		}
		var assignmentID string
		err := tx.QueryRow(ctx, `SELECT id::text FROM patient_clinician_assignments
			WHERE patient_id=$1 AND clinician_id=$2 AND revoked_at IS NULL FOR UPDATE`,
			patientID, clinicianID).Scan(&assignmentID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE patient_clinician_assignments
			SET revoked_at=clock_timestamp(),revoked_by=$2 WHERE id=$1`, assignmentID, actor); err != nil {
			return err
		}
		return audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "clinical_assignment.revoked",
			Object: audit.Object{Type: "patient_clinician_assignment", ID: assignmentID}})
	})
}

func requireAssignmentAdmin(ctx context.Context, tx pgx.Tx, actor string) error {
	var active bool
	err := tx.QueryRow(ctx, `SELECT active FROM staff_accounts WHERE id=$1 FOR SHARE`, actor).Scan(&active)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
		return ErrForbidden
	}
	if err != nil {
		return err
	}
	var role string
	err = tx.QueryRow(ctx, `SELECT role_code FROM staff_roles
		WHERE staff_id=$1 AND role_code='administrator' FOR SHARE`, actor).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrForbidden
	}
	return err
}

func requireActiveClinician(ctx context.Context, tx pgx.Tx, clinicianID string) error {
	var active bool
	err := tx.QueryRow(ctx, `SELECT active FROM staff_accounts WHERE id=$1 FOR SHARE`, clinicianID).Scan(&active)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	var role string
	err = tx.QueryRow(ctx, `SELECT role_code FROM staff_roles
		WHERE staff_id=$1 AND role_code='clinician' FOR SHARE`, clinicianID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}
