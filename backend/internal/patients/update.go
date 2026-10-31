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
		(input.DisplayName == nil && !input.Phone.Set && !input.Identity.Set) {
		return Patient{}, ErrInvalidPatient
	}
	if input.DisplayName != nil && !validName(*input.DisplayName) {
		return Patient{}, ErrInvalidPatient
	}
	if input.Phone.Set && input.Phone.Value != nil && !validPhone(*input.Phone.Value) {
		return Patient{}, ErrInvalidPatient
	}
	if input.Identity.Set && input.Identity.Value != nil && !validIdentity(*input.Identity.Value) {
		return Patient{}, ErrInvalidPatient
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Patient{}, ErrForbidden
	}
	fields := make([]string, 0, 3)
	if input.DisplayName != nil {
		fields = append(fields, "display_name")
	}
	if input.Phone.Set {
		fields = append(fields, "phone")
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
		var currentPhone pgtype.Text
		var version int64
		err := tx.QueryRow(ctx, `SELECT display_name, phone, record_version FROM patients
			WHERE id = $1 FOR UPDATE`, id).Scan(&currentName, &currentPhone, &version)
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
		if input.Phone.Set {
			currentPhone = pgtype.Text{}
			if input.Phone.Value != nil {
				currentPhone = pgtype.Text{String: *input.Phone.Value, Valid: true}
			}
		}
		_, err = tx.Exec(ctx, `UPDATE patients SET display_name = $2, phone = $3,
			record_version = record_version + 1, updated_at = clock_timestamp(), updated_by = $4
			WHERE id = $1`, id, currentName, currentPhone, actor)
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
