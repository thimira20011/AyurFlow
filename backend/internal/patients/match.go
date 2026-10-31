package patients

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

var ErrAmbiguousIdentity = errors.New("patients: multiple exact identity matches")

type IdentityConfirmation struct {
	DisplayName string `json:"displayName"`
	BirthDate   string `json:"birthDate"`
	Phone       string `json:"phone"`
}

// ConfirmNoID requires all three clinic-specified attributes. It does not
// merge records or treat a partial search result as identity confirmation.
func (s *Service) ConfirmNoID(ctx context.Context, actor string, input IdentityConfirmation) (Patient, error) {
	if !validUUID(actor) {
		return Patient{}, ErrForbidden
	}
	if !validName(input.DisplayName) || !validBirthDate(input.BirthDate) {
		return Patient{}, ErrInvalidPatient
	}
	phone, err := NormalizePhone(input.Phone)
	if err != nil {
		return Patient{}, ErrInvalidPatient
	}
	if s == nil || s.pool == nil || s.access == nil {
		return Patient{}, ErrForbidden
	}
	name := strings.Join(strings.Fields(input.DisplayName), " ")
	var matched Patient
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := s.access.CanSearch(ctx, tx, actor); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `SELECT p.id::text FROM patients p
			WHERE p.birth_date=$1::date AND p.phone=$2
			AND lower(btrim(regexp_replace(p.display_name,'[[:space:]]+',' ','g')))=lower($3)
			ORDER BY p.id`, input.BirthDate, phone, name)
		if err != nil {
			return err
		}
		ids := make([]string, 0, 2)
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
			if err := s.access.CanRead(ctx, tx, actor, id); err != nil {
				if errors.Is(err, ErrForbidden) || errors.Is(err, ErrNotFound) {
					continue
				}
				return err
			}
			if matched.ID != "" {
				return ErrAmbiguousIdentity
			}
			matched, err = readPatient(ctx, tx, id)
			if err != nil {
				return err
			}
		}
		if matched.ID == "" {
			return ErrNotFound
		}
		return nil
	})
	return matched, err
}
