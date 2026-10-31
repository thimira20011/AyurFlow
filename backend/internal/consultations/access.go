package consultations

import (
	"context"
	"errors"

	"ayurflow/backend/internal/authorization"

	"github.com/jackc/pgx/v5"
)

// AssignedPolicy uses the shared active-role check and an explicit, current
// patient assignment in the caller's transaction. Missing assignments deny.
type AssignedPolicy struct{}

func (AssignedPolicy) CanCreate(ctx context.Context, tx pgx.Tx, actor, patientID string) error {
	return requireAssignment(ctx, tx, actor, patientID, authorization.ClinicalWrite)
}

func (AssignedPolicy) CanList(ctx context.Context, tx pgx.Tx, actor, patientID string) error {
	return requireAssignment(ctx, tx, actor, patientID, authorization.ClinicalRead)
}

func (AssignedPolicy) CanRead(ctx context.Context, tx pgx.Tx, actor, patientID, _ string) error {
	return requireAssignment(ctx, tx, actor, patientID, authorization.ClinicalRead)
}

func (AssignedPolicy) CanEdit(ctx context.Context, tx pgx.Tx, actor, patientID, _ string) error {
	return requireAssignment(ctx, tx, actor, patientID, authorization.ClinicalWrite)
}

func requireAssignment(ctx context.Context, tx pgx.Tx, actor, patientID string, action authorization.Action) error {
	err := (&authorization.Authorizer{Records: clinicalAssignments{}}).Require(ctx, tx, actor, action,
		authorization.Resource{Kind: "patient", ID: patientID})
	if errors.Is(err, authorization.ErrForbidden) {
		return ErrForbidden
	}
	return err
}

type clinicalAssignments struct{}

func (clinicalAssignments) AuthorizeRecord(ctx context.Context, tx pgx.Tx, actor string, action authorization.Action, target authorization.Resource) error {
	if target.Kind != "patient" || (action != authorization.ClinicalRead && action != authorization.ClinicalWrite) {
		return authorization.ErrForbidden
	}
	// FOR SHARE serializes a protected operation with a later revocation.
	var id string
	err := tx.QueryRow(ctx, `SELECT id::text FROM patient_clinician_assignments
		WHERE patient_id=$1 AND clinician_id=$2 AND revoked_at IS NULL FOR SHARE`, target.ID, actor).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return authorization.ErrForbidden
	}
	return err
}
