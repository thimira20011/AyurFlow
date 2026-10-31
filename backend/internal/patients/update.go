package patients

import (
	"context"
	"errors"

	"ayurflow/backend/internal/audit"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func (s *Service) Update(ctx context.Context, actor, id string, input UpdateInput) (Patient, error) {
	if !validUUID(actor) || !validUUID(id) || input.Version <= 0 ||
		(input.DisplayName == nil && !input.BirthDate.Set && !input.Gender.Set &&
			!input.Phone.Set && !input.Address.Set && !input.Identity.Set) {
		return Patient{}, ErrInvalidPatient
	}
	if input.DisplayName != nil && !validName(*input.DisplayName) {
		return Patient{}, ErrInvalidPatient
	}
	if input.Phone.Set && (input.Phone.Value == nil || !validPhone(*input.Phone.Value)) {
		return Patient{}, ErrInvalidPatient
	}
	if input.BirthDate.Set && (input.BirthDate.Value == nil || !validBirthDate(*input.BirthDate.Value)) {
		return Patient{}, ErrInvalidPatient
	}
	if input.Gender.Set && (input.Gender.Value == nil || !validGender(*input.Gender.Value)) {
		return Patient{}, ErrInvalidPatient
	}
	if input.Address.Set && input.Address.Value != nil && !validOptionalText(*input.Address.Value, 1024) {
		return Patient{}, ErrInvalidPatient
	}
	if input.Identity.Set && input.Identity.Value != nil && !validIdentity(*input.Identity.Value) {
		return Patient{}, ErrInvalidPatient
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Patient{}, ErrForbidden
	}
	fields := make([]string, 0, 6)
	if input.DisplayName != nil {
		fields = append(fields, "display_name")
	}
	if input.BirthDate.Set {
		fields = append(fields, "birth_date")
	}
	if input.Gender.Set {
		fields = append(fields, "gender")
	}
	if input.Phone.Set {
		fields = append(fields, "phone")
	}
	if input.Address.Set {
		fields = append(fields, "address")
	}
	if input.Identity.Set {
		fields = append(fields, "identity")
	}
	var updated Patient
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := s.access.CanEdit(ctx, tx, actor, id, fields); err != nil {
			return err
		}
		var currentName string
		var currentBirthDate, currentGender, currentPhone, currentAddress pgtype.Text
		var version int64
		err := tx.QueryRow(ctx, `SELECT display_name, birth_date::text, gender, phone, address, record_version FROM patients
			WHERE id = $1 FOR UPDATE`, id).Scan(
			&currentName, &currentBirthDate, &currentGender, &currentPhone, &currentAddress, &version)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if version != input.Version {
			return ErrStaleVersion
		}
		if input.DisplayName != nil {
			currentName = *input.DisplayName
		}
		if input.BirthDate.Set {
			currentBirthDate = optionalText(input.BirthDate.Value)
		}
		if input.Gender.Set {
			currentGender = optionalText(input.Gender.Value)
		}
		if input.Phone.Set {
			currentPhone = optionalText(input.Phone.Value)
		}
		if input.Address.Set {
			currentAddress = optionalText(input.Address.Value)
		}
		_, err = tx.Exec(ctx, `UPDATE patients SET display_name = $2, birth_date = $3::date,
			gender = $4, phone = $5, address = $6,
			record_version = record_version + 1, updated_at = clock_timestamp(), updated_by = $7
			WHERE id = $1`, id, currentName, nullableText(currentBirthDate), currentGender,
			currentPhone, currentAddress, actor)
		if err != nil {
			return err
		}
		if input.Identity.Set {
			if input.Identity.Value == nil {
				_, err = tx.Exec(ctx, `DELETE FROM patient_identities WHERE patient_id = $1`, id)
			} else {
				_, err = tx.Exec(ctx, `INSERT INTO patient_identities(patient_id, identity_type, original_value)
					VALUES ($1, $2, $3) ON CONFLICT (patient_id)
					DO UPDATE SET identity_type = EXCLUDED.identity_type,
					original_value = EXCLUDED.original_value`, id,
					input.Identity.Value.Type, input.Identity.Value.Value)
			}
			if err != nil {
				return identityError(err)
			}
		}
		if err := audit.Write(ctx, tx, audit.Event{
			ActorID: actor, Action: "patient.updated", Object: audit.Object{Type: "patient", ID: id},
			ReasonCode: "demographic_correction", ChangedFields: fields,
		}); err != nil {
			return err
		}
		updated, err = readPatient(ctx, tx, id)
		return err
	})
	return updated, err
}

func optionalText(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func nullableText(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}
