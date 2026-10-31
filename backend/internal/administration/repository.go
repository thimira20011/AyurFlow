package administration

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func requireAdmin(ctx context.Context, tx pgx.Tx, actor string) error {
	var active bool
	err := tx.QueryRow(ctx, `SELECT staff.active FROM staff_accounts staff
		JOIN staff_roles role ON role.staff_id=staff.id
		WHERE staff.id=$1 AND role.role_code='administrator'
		FOR SHARE OF staff,role`, actor).Scan(&active)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
		return ErrForbidden
	}
	return err
}

func readStaff(ctx context.Context, tx pgx.Tx, id string) (Staff, error) {
	var staff Staff
	err := tx.QueryRow(ctx, `SELECT id::text,login_identifier,active,created_at,
		ARRAY(SELECT role_code FROM staff_roles WHERE staff_id=staff.id ORDER BY role_code)
		FROM staff_accounts staff WHERE id=$1`, id).Scan(
		&staff.ID, &staff.LoginIdentifier, &staff.Active, &staff.CreatedAt, &staff.Roles,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Staff{}, ErrNotFound
	}
	return staff, err
}

func validateRoles(ctx context.Context, tx pgx.Tx, roles []string) error {
	var count int
	err := tx.QueryRow(ctx, `SELECT count(*) FROM roles WHERE code=ANY($1::text[])`, roles).Scan(&count)
	if err == nil && count != len(roles) {
		return ErrInvalid
	}
	return err
}

func insertRoles(ctx context.Context, tx pgx.Tx, id string, roles []string) error {
	_, err := tx.Exec(ctx, `INSERT INTO staff_roles(staff_id,role_code)
		SELECT $1,unnest($2::text[])`, id, roles)
	return err
}

func accountError(err error) error {
	var databaseError *pgconn.PgError
	if errors.As(err, &databaseError) && databaseError.Code == "23505" {
		return ErrConflict
	}
	return err
}
