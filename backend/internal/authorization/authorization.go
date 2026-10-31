// Package authorization enforces provisional backend role and record policies.
package authorization

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var ErrForbidden = errors.New("authorization: access denied")

type Action string

const (
	PatientRegister Action = "patient.register"
	PatientSearch   Action = "patient.search"
	PatientRead     Action = "patient.read"
	PatientEdit     Action = "patient.edit"
	ClinicalRead    Action = "clinical.read"
	ClinicalWrite   Action = "clinical.write"
	SessionRead     Action = "session.read"
	SessionWrite    Action = "session.write"
)

type Resource struct {
	Kind string
	ID   string
}

// RecordAccess is implemented by the owning module using authoritative assignment
// data and the caller's transaction. A missing adapter denies clinical/session access.
// A write adapter must lock assignment/state rows to serialize revocation and mutation.
type RecordAccess interface {
	AuthorizeRecord(context.Context, pgx.Tx, string, Action, Resource) error
}

type Authorizer struct {
	Records RecordAccess
}

// Require rechecks account/role state in the business transaction. Session role
// snapshots, client headers and administrator status never grant implicit access.
func (a *Authorizer) Require(ctx context.Context, tx pgx.Tx, actor string, action Action, target Resource) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if a == nil || tx == nil || !validUUID(actor) {
		return ErrForbidden
	}
	role := ""
	needsAssignment := false
	switch action {
	case PatientRegister, PatientSearch:
		if target != (Resource{}) {
			return ErrForbidden
		}
		role = "receptionist"
	case PatientRead, PatientEdit:
		if target.Kind != "patient" || !validUUID(target.ID) {
			return ErrForbidden
		}
		role = "receptionist"
	case ClinicalRead, ClinicalWrite:
		if target.Kind != "patient" || !validUUID(target.ID) {
			return ErrForbidden
		}
		role, needsAssignment = "clinician", true
	case SessionRead, SessionWrite:
		if target.Kind != "session" || !validUUID(target.ID) {
			return ErrForbidden
		}
		role, needsAssignment = "therapist", true
	default:
		// Audit, reports, exports and other module actions need explicit policies;
		// an unknown action is never interpreted as broad read access.
		return ErrForbidden
	}
	if needsAssignment && a.Records == nil {
		return ErrForbidden
	}
	var active bool
	err := tx.QueryRow(ctx, `SELECT active FROM staff_accounts WHERE id=$1 FOR SHARE`, actor).Scan(&active)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
		return ErrForbidden
	}
	if err != nil {
		return err
	}
	var held string
	err = tx.QueryRow(ctx, `SELECT role_code FROM staff_roles
		WHERE staff_id=$1 AND role_code=$2 FOR SHARE`, actor, role).Scan(&held)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrForbidden
	}
	if err != nil {
		return err
	}
	if needsAssignment {
		return a.Records.AuthorizeRecord(ctx, tx, actor, action, target)
	}
	if target.Kind == "patient" {
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM patients WHERE id=$1)`, target.ID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return ErrForbidden
		}
	}
	return nil
}

func validUUID(value string) bool {
	var id pgtype.UUID
	return id.Scan(value) == nil && id.Valid && id.Bytes != [16]byte{}
}
