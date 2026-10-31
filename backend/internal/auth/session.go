package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"ayurflow/backend/internal/config"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/argon2"
)

var ErrCredentials = errors.New("invalid credentials")
var ErrSession = errors.New("invalid session")

type Session struct {
	StaffID   string    `json:"staffId"`
	Roles     []string  `json:"roles"`
	CSRFToken string    `json:"csrfToken"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type Service struct {
	pool        *pgxpool.Pool
	policy      config.AuthPolicy
	clock       func() time.Time
	verifySlots chan struct{}
}

func NewService(pool *pgxpool.Pool, policy config.AuthPolicy) *Service {
	// Argon2id uses 64 MiB per verification. Bound simultaneous work per API process.
	return &Service{
		pool: pool, policy: policy, clock: time.Now, verifySlots: make(chan struct{}, 4),
	}
}

// Login serializes attempts for each normalized identifier in PostgreSQL, including
// attempts for nonexistent accounts. This keeps throttling consistent across API workers.
func (s *Service) Login(ctx context.Context, identifier, password, previousToken string) (Session, string, error) {
	identifier = strings.ToLower(strings.TrimSpace(identifier))
	if identifier == "" || len(identifier) > 64 || password == "" || len(password) > 1024 {
		return Session{}, "", ErrCredentials
	}
	select {
	case s.verifySlots <- struct{}{}:
		defer func() { <-s.verifySlots }()
	case <-ctx.Done():
		return Session{}, "", ctx.Err()
	}
	now := s.clock().UTC()
	key := sha256.Sum256([]byte(identifier))
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Session{}, "", err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `INSERT INTO auth_login_attempts(identifier_hash, failures, window_started_at)
		VALUES ($1, 0, $2) ON CONFLICT (identifier_hash) DO NOTHING`, key[:], now)
	if err != nil {
		return Session{}, "", err
	}
	var failures int
	var windowStart time.Time
	var blockedUntil *time.Time
	err = tx.QueryRow(ctx, `SELECT failures, window_started_at, blocked_until
		FROM auth_login_attempts WHERE identifier_hash=$1 FOR UPDATE`, key[:]).Scan(&failures, &windowStart, &blockedUntil)
	if err != nil {
		return Session{}, "", err
	}
	now = s.clock().UTC()
	if blockedUntil != nil && now.Before(*blockedUntil) {
		return Session{}, "", ErrCredentials
	}
	if !now.Before(windowStart.Add(s.policy.AttemptWindow)) {
		failures = 0
		windowStart = now
	}
	var staffID, passwordHash string
	var active bool
	err = tx.QueryRow(ctx, `SELECT id::text, password_hash, active
		FROM staff_accounts WHERE login_identifier=$1`, identifier).Scan(&staffID, &passwordHash, &active)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return Session{}, "", err
	}
	valid := false
	if err == nil {
		valid, err = VerifyPassword(password, passwordHash)
		if err != nil {
			valid = false
			burnPasswordWork(password)
		}
	} else {
		burnPasswordWork(password)
	}
	if active && valid {
		// Account administration locks this row before revoking sessions. Recheck
		// after password work so disable cannot miss a newly issued valid session.
		err = tx.QueryRow(ctx, `SELECT active FROM staff_accounts WHERE id=$1 FOR SHARE`, staffID).Scan(&active)
		if err != nil {
			return Session{}, "", err
		}
	}
	// Password verification and account locks can wait; never backdate a session.
	now = s.clock().UTC()
	if !active || !valid {
		failures++
		var nextBlock *time.Time
		if failures >= s.policy.AttemptLimit {
			until := now.Add(s.policy.BlockDuration)
			nextBlock = &until
		}
		_, err = tx.Exec(ctx, `UPDATE auth_login_attempts SET failures=$2,
			window_started_at=$3, blocked_until=$4 WHERE identifier_hash=$1`, key[:], failures, windowStart, nextBlock)
		if err != nil {
			return Session{}, "", err
		}
		if err = tx.Commit(ctx); err != nil {
			return Session{}, "", err
		}
		return Session{}, "", ErrCredentials
	}
	token, tokenHash, err := newSecret()
	if err != nil {
		return Session{}, "", err
	}
	csrf, csrfHash, err := newSecret()
	if err != nil {
		return Session{}, "", err
	}
	expires := now.Add(s.policy.AbsoluteTimeout)
	_, err = tx.Exec(ctx, `INSERT INTO staff_sessions
		(staff_id, token_hash, csrf_token_hash, created_at, last_seen_at, expires_at)
		VALUES ($1, $2, $3, $4, $4, $5)`, staffID, tokenHash[:], csrfHash[:], now, expires)
	if err != nil {
		return Session{}, "", err
	}
	if previousHash, ok := secretHash(previousToken); ok {
		_, err = tx.Exec(ctx, `UPDATE staff_sessions SET revoked_at=$2
			WHERE token_hash=$1 AND revoked_at IS NULL`, previousHash[:], now)
		if err != nil {
			return Session{}, "", err
		}
	}
	_, err = tx.Exec(ctx, `DELETE FROM auth_login_attempts WHERE identifier_hash=$1`, key[:])
	if err != nil {
		return Session{}, "", err
	}
	rows, err := tx.Query(ctx, `SELECT role_code FROM staff_roles WHERE staff_id=$1 ORDER BY role_code`, staffID)
	if err != nil {
		return Session{}, "", err
	}
	roles := make([]string, 0)
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			rows.Close()
			return Session{}, "", err
		}
		roles = append(roles, role)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return Session{}, "", err
	}
	if err = tx.Commit(ctx); err != nil {
		return Session{}, "", err
	}
	return Session{StaffID: staffID, Roles: roles, CSRFToken: csrf, ExpiresAt: expires}, token, nil
}

func burnPasswordWork(password string) {
	// Unknown accounts must take comparable password-verification work.
	argon2.IDKey([]byte(password), []byte("ayurflow-no-user"), argonPasses,
		argonMemoryKiB, argonThreads, keyLength)
}

// Validate enforces account status and both expiry boundaries before refreshing idle time.
func (s *Service) Validate(ctx context.Context, token string) (Session, error) {
	hash, ok := secretHash(token)
	if !ok {
		return Session{}, ErrSession
	}
	csrf, csrfHash, err := newSecret()
	if err != nil {
		return Session{}, err
	}
	var session Session
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		state, err := s.lockSession(ctx, tx, hash)
		if err != nil {
			return err
		}
		session = state.Session
		_, err = tx.Exec(
			ctx,
			`UPDATE staff_sessions SET last_seen_at=$2,csrf_token_hash=$3 WHERE token_hash=$1`,
			hash[:],
			state.checkedAt,
			csrfHash[:],
		)
		return err
	})
	if err != nil {
		return Session{}, err
	}
	session.CSRFToken = csrf
	session.Roles, err = s.roles(ctx, session.StaffID)
	return session, err
}

func (s *Service) Logout(ctx context.Context, token, csrf string) error {
	tokenHash, ok := secretHash(token)
	if !ok {
		return ErrSession
	}
	csrfHash, ok := secretHash(csrf)
	if !ok {
		return ErrCSRF
	}
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		state, err := s.lockSession(ctx, tx, tokenHash)
		if err != nil {
			return err
		}
		if subtle.ConstantTimeCompare(csrfHash[:], state.csrfHash) != 1 {
			return ErrCSRF
		}
		_, err = tx.Exec(ctx, `UPDATE staff_sessions SET revoked_at=$2 WHERE token_hash=$1`, tokenHash[:], state.checkedAt)
		return err
	})
}

// RevokeStaffSessions is called in the same transaction as an account disable.
func RevokeStaffSessions(ctx context.Context, tx pgx.Tx, staffID string, at time.Time) error {
	_, err := tx.Exec(ctx, `UPDATE staff_sessions SET revoked_at=$2
		WHERE staff_id=$1 AND revoked_at IS NULL`, staffID, at.UTC())
	return err
}

func (s *Service) roles(ctx context.Context, staffID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT role_code FROM staff_roles WHERE staff_id=$1 ORDER BY role_code`, staffID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	roles := make([]string, 0)
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	return roles, rows.Err()
}

func newSecret() (string, [32]byte, error) {
	var raw [32]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", [32]byte{}, err
	}
	return base64.RawURLEncoding.EncodeToString(raw[:]), sha256.Sum256(raw[:]), nil
}

func secretHash(encoded string) ([32]byte, bool) {
	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil || len(raw) != 32 {
		return [32]byte{}, false
	}
	return sha256.Sum256(raw), true
}
