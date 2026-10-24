package patients

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

func readPatient(ctx context.Context, tx pgx.Tx, id string) (Patient, error) {
	var patient Patient
	var phone, identityType, identityValue pgtype.Text
	// Read demographics and optional identity from one committed statement snapshot.
	err := tx.QueryRow(ctx, `SELECT p.id::text, p.display_name, p.phone, p.record_version,
		p.created_at, p.updated_at, i.identity_type, i.original_value
		FROM patients p LEFT JOIN patient_identities i ON i.patient_id = p.id
		WHERE p.id = $1`, id).Scan(
		&patient.ID, &patient.DisplayName, &phone, &patient.Version,
		&patient.CreatedAt, &patient.UpdatedAt, &identityType, &identityValue,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Patient{}, ErrNotFound
	}
	if err != nil {
		return Patient{}, err
	}
	if phone.Valid {
		patient.Phone = &phone.String
	}
	if identityType.Valid {
		patient.Identity = &IdentityInput{Type: identityType.String, Value: identityValue.String}
	}
	return patient, nil
}

func identityError(err error) error {
	var dbErr *pgconn.PgError
	if errors.As(err, &dbErr) && dbErr.Code == "23505" &&
		dbErr.ConstraintName == "patient_identities_type_canonical_unique" {
		return ErrDuplicateIdentity
	}
	return err
}
