package patients

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

func readPatient(ctx context.Context, tx pgx.Tx, id string) (Patient, error) {
	var patient Patient
	var registryNumber int64
	var birthDate, gender, phone, address, identityType, identityValue pgtype.Text
	// Read demographics and optional identity from one committed statement snapshot.
	err := tx.QueryRow(ctx, `SELECT p.id::text, p.registry_number, p.display_name, p.birth_date::text, p.gender, p.phone, p.address, p.record_version,
		p.created_at, p.updated_at, i.identity_type, i.original_value
		FROM patients p LEFT JOIN patient_identities i ON i.patient_id = p.id
		WHERE p.id = $1`, id).Scan(
		&patient.ID, &registryNumber, &patient.DisplayName, &birthDate, &gender, &phone, &address, &patient.Version,
		&patient.CreatedAt, &patient.UpdatedAt, &identityType, &identityValue,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Patient{}, ErrNotFound
	}
	if err != nil {
		return Patient{}, err
	}
	patient.PatientCode = fmt.Sprintf("AYUR-PT-%05d", registryNumber)
	if phone.Valid {
		patient.Phone = &phone.String
	}
	if birthDate.Valid {
		patient.BirthDate = &birthDate.String
	}
	if gender.Valid {
		patient.Gender = &gender.String
	}
	if address.Valid {
		patient.Address = &address.String
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
