package consultations

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func consultationPatientID(ctx context.Context, tx pgx.Tx, id string) (string, error) {
	var patientID string
	err := tx.QueryRow(ctx, `SELECT patient_id::text FROM consultations WHERE id=$1`, id).Scan(&patientID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return patientID, err
}

func readConsultation(ctx context.Context, tx pgx.Tx, patientID, id string) (Consultation, error) {
	var record Consultation
	err := tx.QueryRow(ctx, `SELECT id::text, patient_id::text, status,
		COALESCE(draft_text,''), COALESCE(signed_text,''), COALESCE(signed_by::text,''),
		signed_at, record_version, created_at, created_by::text, updated_at, updated_by::text
		FROM consultations WHERE id=$1 AND patient_id=$2`, id, patientID).Scan(
		&record.ID, &record.PatientID, &record.Status, &record.DraftText,
		&record.SignedText, &record.SignedBy, &record.SignedAt, &record.Version,
		&record.CreatedAt, &record.CreatedBy, &record.UpdatedAt, &record.UpdatedBy,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Consultation{}, ErrNotFound
	}
	if err != nil {
		return Consultation{}, err
	}
	rows, err := tx.Query(ctx, `SELECT id::text, consultation_id::text, author_id::text,
		created_at, reason, body FROM consultation_addenda
		WHERE consultation_id=$1 ORDER BY created_at, id`, id)
	if err != nil {
		return Consultation{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var addendum Addendum
		if err := rows.Scan(&addendum.ID, &addendum.ConsultationID, &addendum.AuthorID,
			&addendum.CreatedAt, &addendum.Reason, &addendum.Body); err != nil {
			return Consultation{}, err
		}
		record.Addenda = append(record.Addenda, addendum)
	}
	return record, rows.Err()
}
