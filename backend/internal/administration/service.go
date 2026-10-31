package administration

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"ayurflow/backend/internal/audit"
	"ayurflow/backend/internal/auth"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

func (s *Service) List(ctx context.Context, actor, after string) (Page, error) {
	page := Page{Items: []Staff{}, Roles: []Role{}}
	if !validID(actor) {
		return page, ErrForbidden
	}
	if after == "" {
		after = "00000000-0000-0000-0000-000000000000"
	} else if !validID(after) {
		return page, ErrInvalid
	}
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := requireAdmin(ctx, tx, actor); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `SELECT id::text,login_identifier,active,created_at,
			ARRAY(SELECT role_code FROM staff_roles WHERE staff_id=staff.id ORDER BY role_code)
			FROM staff_accounts staff WHERE id>$1::uuid ORDER BY id LIMIT 26`, after)
		if err != nil {
			return err
		}
		page.Items, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Staff, error) {
			var staff Staff
			err := row.Scan(&staff.ID, &staff.LoginIdentifier, &staff.Active, &staff.CreatedAt, &staff.Roles)
			return staff, err
		})
		if err != nil {
			return err
		}
		if len(page.Items) > 25 {
			page.Items = page.Items[:25]
			page.NextCursor = page.Items[24].ID
		}
		rows, err = tx.Query(ctx, `SELECT code,name FROM roles ORDER BY code`)
		if err != nil {
			return err
		}
		page.Roles, err = pgx.CollectRows(rows, pgx.RowToStructByPos[Role])
		return err
	})
	return page, err
}

func (s *Service) Create(ctx context.Context, actor string, input CreateInput) (Staff, error) {
	actor = canonicalID(actor)
	input.LoginIdentifier = strings.ToLower(strings.TrimSpace(input.LoginIdentifier))
	validLogin := input.LoginIdentifier != "" && len(input.LoginIdentifier) <= 64 && utf8.ValidString(input.LoginIdentifier)
	for _, r := range input.LoginIdentifier {
		if unicode.IsControl(r) {
			validLogin = false
		}
	}
	validPassword := utf8.ValidString(input.Password) &&
		utf8.RuneCountInString(input.Password) >= 15 && len(input.Password) <= 1024
	roles, err := checkedRoles(input.Roles)
	if !validLogin || !validPassword || err != nil {
		return Staff{}, ErrInvalid
	}
	var created Staff
	err = s.change(ctx, actor, "", func(tx pgx.Tx) error {
		if err := validateRoles(ctx, tx, roles); err != nil {
			return err
		}
		// The shared admin transaction lock serializes this low-volume Argon2 work too.
		hash, err := auth.HashPassword(input.Password)
		if err != nil {
			return err
		}
		var id string
		err = tx.QueryRow(
			ctx,
			`INSERT INTO staff_accounts(login_identifier,password_hash) VALUES($1,$2) RETURNING id::text`,
			input.LoginIdentifier,
			hash,
		).Scan(&id)
		if err != nil {
			return accountError(err)
		}
		if err := insertRoles(ctx, tx, id, roles); err != nil {
			return err
		}
		if err := audit.Write(ctx, tx, audit.Event{
			ActorID: actor, Action: "staff.created", Object: audit.Object{Type: "staff", ID: id},
			ChangedFields: []string{"roles"},
		}); err != nil {
			return err
		}
		created, err = readStaff(ctx, tx, id)
		return err
	})
	return created, err
}

func (s *Service) SetRoles(ctx context.Context, actor, target string, input []string) (Staff, error) {
	actor, target = canonicalID(actor), canonicalID(target)
	roles, err := checkedRoles(input)
	if err != nil || !validID(target) {
		return Staff{}, ErrInvalid
	}
	var changed Staff
	err = s.change(ctx, actor, target, func(tx pgx.Tx) error {
		if actor == target && !slices.Contains(roles, "administrator") {
			return ErrConflict
		}
		if err := validateRoles(ctx, tx, roles); err != nil {
			return err
		}
		current, err := readStaff(ctx, tx, target)
		if err != nil {
			return err
		}
		if !current.Active {
			return ErrConflict
		}
		if slices.Equal(current.Roles, roles) {
			changed = current
			return nil
		}
		if _, err := tx.Exec(ctx, `DELETE FROM staff_roles WHERE staff_id=$1`, target); err != nil {
			return err
		}
		if err := insertRoles(ctx, tx, target, roles); err != nil {
			return err
		}
		if err := auth.RevokeStaffSessions(ctx, tx, target, time.Now()); err != nil {
			return err
		}
		if err := audit.Write(ctx, tx, audit.Event{
			ActorID: actor, Action: "staff.roles_changed", Object: audit.Object{Type: "staff", ID: target},
			ChangedFields: []string{"roles"},
		}); err != nil {
			return err
		}
		changed, err = readStaff(ctx, tx, target)
		return err
	})
	return changed, err
}

func (s *Service) Disable(ctx context.Context, actor, target string) error {
	actor, target = canonicalID(actor), canonicalID(target)
	if !validID(target) {
		return ErrInvalid
	}
	return s.change(ctx, actor, target, func(tx pgx.Tx) error {
		if actor == target {
			return ErrConflict
		}
		current, err := readStaff(ctx, tx, target)
		if err != nil {
			return err
		}
		if !current.Active {
			return nil
		}
		if _, err := tx.Exec(ctx, `UPDATE staff_accounts SET active=false WHERE id=$1`, target); err != nil {
			return err
		}
		if err := auth.RevokeStaffSessions(ctx, tx, target, time.Now()); err != nil {
			return err
		}
		return audit.Write(ctx, tx, audit.Event{
			ActorID: actor, Action: "staff.disabled", Object: audit.Object{Type: "staff", ID: target},
			ChangedFields: []string{"active"},
		})
	})
}

func (s *Service) change(ctx context.Context, actor, target string, apply func(pgx.Tx) error) error {
	if !validID(actor) {
		return ErrForbidden
	}
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		// Serialize privilege changes before taking any account/role locks.
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(5109008)`); err != nil {
			return err
		}
		if err := requireAdmin(ctx, tx, actor); err != nil {
			return err
		}
		if target != "" {
			var id string
			err := tx.QueryRow(ctx, `SELECT id::text FROM staff_accounts WHERE id=$1 FOR UPDATE`, target).Scan(&id)
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNotFound
			}
			if err != nil {
				return err
			}
		}
		return apply(tx)
	})
}

func checkedRoles(input []string) ([]string, error) {
	if len(input) == 0 || len(input) > 32 {
		return nil, ErrInvalid
	}
	roles := append([]string{}, input...)
	slices.Sort(roles)
	if len(slices.Compact(append([]string{}, roles...))) != len(roles) {
		return nil, ErrInvalid
	}
	return roles, nil
}

func validID(value string) bool {
	var id pgtype.UUID
	return id.Scan(value) == nil && id.Valid && id.Bytes != [16]byte{}
}

func canonicalID(value string) string {
	var id pgtype.UUID
	if id.Scan(value) != nil || !id.Valid || id.Bytes == [16]byte{} {
		return ""
	}
	return id.String()
}
