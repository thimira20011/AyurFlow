package authorization

import (
	"context"
	"errors"

	"ayurflow/backend/internal/patients"

	"github.com/jackc/pgx/v5"
)

// PatientPolicy adapts the shared policy to the patient module's transaction API.
// Reception may access demographics only; this grants no clinical note access.
type PatientPolicy struct {
	Authorizer Authorizer
}

var _ patients.AccessPolicy = (*PatientPolicy)(nil)

func (p *PatientPolicy) CanRegister(ctx context.Context, tx pgx.Tx, actor string) error {
	return p.require(ctx, tx, actor, PatientRegister, Resource{})
}

func (p *PatientPolicy) CanSearch(ctx context.Context, tx pgx.Tx, actor string) error {
	return p.require(ctx, tx, actor, PatientSearch, Resource{})
}

func (p *PatientPolicy) CanRead(ctx context.Context, tx pgx.Tx, actor, id string) error {
	return p.require(ctx, tx, actor, PatientRead, Resource{Kind: "patient", ID: id})
}

func (p *PatientPolicy) CanEdit(ctx context.Context, tx pgx.Tx, actor, id string, fields []string) error {
	if len(fields) == 0 {
		return patients.ErrForbidden
	}
	for _, field := range fields {
		if field != "display_name" && field != "phone" && field != "identity" {
			return patients.ErrForbidden
		}
	}
	return p.require(ctx, tx, actor, PatientEdit, Resource{Kind: "patient", ID: id})
}

func (p *PatientPolicy) require(ctx context.Context, tx pgx.Tx, actor string, action Action, target Resource) error {
	if p == nil {
		return patients.ErrForbidden
	}
	err := p.Authorizer.Require(ctx, tx, actor, action, target)
	if errors.Is(err, ErrForbidden) {
		return patients.ErrForbidden
	}
	return err
}
