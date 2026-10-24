package auth

import (
	"context"
	"crypto/subtle"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrCSRF = errors.New("invalid csrf token")

type lockedSession struct {
	Session
	csrfHash  []byte
	checkedAt time.Time
}

// Sample expiry time after database waits, while the session/account locks are held.
func (s *Service) lockSession(ctx context.Context, tx pgx.Tx, hash [32]byte) (lockedSession, error) {
	var state lockedSession
	var lastSeen time.Time
	err := tx.QueryRow(ctx, `SELECT staff.id::text, sess.expires_at, sess.csrf_token_hash, sess.last_seen_at
		FROM staff_sessions sess JOIN staff_accounts staff ON staff.id=sess.staff_id
		WHERE sess.token_hash=$1 AND staff.active AND sess.revoked_at IS NULL
		FOR UPDATE OF sess FOR SHARE OF staff`, hash[:]).Scan(
		&state.StaffID,
		&state.ExpiresAt,
		&state.csrfHash,
		&lastSeen,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return lockedSession{}, ErrSession
	}
	if err != nil {
		return lockedSession{}, err
	}
	state.checkedAt = s.clock().UTC()
	absoluteExpired := !state.checkedAt.Before(state.ExpiresAt)
	idleExpired := !state.checkedAt.Before(lastSeen.Add(s.policy.IdleTimeout))
	if absoluteExpired || idleExpired {
		return lockedSession{}, ErrSession
	}
	return state, nil
}

// Authenticate validates a protected read without rotating the CSRF token.
func (s *Service) Authenticate(ctx context.Context, token string) (Session, error) {
	return s.authenticate(ctx, token, "", false)
}

// AuthenticateCSRF validates a protected mutation before refreshing idle time.
// The transport must independently enforce the configured same-origin policy.
func (s *Service) AuthenticateCSRF(ctx context.Context, token, csrf string) (Session, error) {
	return s.authenticate(ctx, token, csrf, true)
}

func (s *Service) authenticate(ctx context.Context, token, csrf string, requireCSRF bool) (Session, error) {
	hash, ok := secretHash(token)
	if !ok {
		return Session{}, ErrSession
	}
	var session Session
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		state, err := s.lockSession(ctx, tx, hash)
		if err != nil {
			return err
		}
		session = state.Session
		if requireCSRF {
			provided, valid := secretHash(csrf)
			if !valid || subtle.ConstantTimeCompare(provided[:], state.csrfHash) != 1 {
				return ErrCSRF
			}
		}
		rows, err := tx.Query(ctx, `SELECT role_code FROM staff_roles WHERE staff_id=$1 ORDER BY role_code`, session.StaffID)
		if err != nil {
			return err
		}
		session.Roles, err = pgx.CollectRows(rows, pgx.RowTo[string])
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE staff_sessions SET last_seen_at=$2 WHERE token_hash=$1`, hash[:], state.checkedAt)
		return err
	})
	if err != nil {
		return Session{}, err
	}
	// Never return the stored CSRF hash or a fresh token from middleware lookups.
	return session, nil
}
