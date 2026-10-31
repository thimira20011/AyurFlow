//go:build integration

package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"ayurflow/backend/internal/config"
	"ayurflow/backend/internal/testutil"
)

// AUTH_TEST_DATABASE_URL must name a disposable PostgreSQL database.
func TestSessionLifecycleIntegration(t *testing.T) {
	pool := testutil.Postgres(t, "AUTH_TEST_DATABASE_URL")
	ctx, cancel := context.WithTimeout(t.Context(), 2*time.Minute)
	defer cancel()
	password := "synthetic-password-123"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	login := "auth-test-" + time.Now().UTC().Format("20060102150405.000000000")
	var staffID string
	err = pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier, password_hash)
		VALUES ($1, $2) RETURNING id::text`, login, hash).Scan(&staffID)
	if err != nil {
		t.Fatal(err)
	}
	policy := config.AuthPolicy{
		Enabled: true, IdleTimeout: 15 * time.Minute, AbsoluteTimeout: time.Hour,
		AttemptLimit: 2, AttemptWindow: 10 * time.Minute, BlockDuration: 5 * time.Minute,
	}
	service := NewService(pool, policy)
	base := time.Now().UTC()
	service.clock = func() time.Time { return base }
	if _, _, err := service.Login(ctx, login, "wrong", ""); !errors.Is(err, ErrCredentials) {
		t.Fatalf("wrong password: %v", err)
	}
	if _, _, err := service.Login(ctx, login, "wrong", ""); !errors.Is(err, ErrCredentials) {
		t.Fatalf("second wrong password: %v", err)
	}
	if _, _, err := service.Login(ctx, login, password, ""); !errors.Is(err, ErrCredentials) {
		t.Fatalf("blocked login: %v", err)
	}
	service.clock = func() time.Time { return base.Add(6 * time.Minute) }
	_, token, err := service.Login(ctx, login, password, "")
	if err != nil {
		t.Fatal(err)
	}
	_, replacement, err := service.Login(ctx, login, password, token)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Validate(ctx, token); !errors.Is(err, ErrSession) {
		t.Fatalf("replaced token: %v", err)
	}
	token = replacement
	session, err := service.Validate(ctx, token)
	if err != nil || session.CSRFToken == "" {
		t.Fatalf("valid session: %v", err)
	}
	if err := service.Logout(ctx, token, "wrong"); !errors.Is(err, ErrCSRF) {
		t.Fatalf("wrong CSRF: %v", err)
	}
	if err := service.Logout(ctx, token, session.CSRFToken); err != nil {
		t.Fatalf("logout: %v", err)
	}
	if _, err := service.Validate(ctx, token); !errors.Is(err, ErrSession) {
		t.Fatalf("logged out token: %v", err)
	}
	_, token, err = service.Login(ctx, login, password, "")
	if err != nil {
		t.Fatal(err)
	}
	service.clock = func() time.Time { return base.Add(22 * time.Minute) }
	if _, err := service.Validate(ctx, token); !errors.Is(err, ErrSession) {
		t.Fatalf("idle expired token: %v", err)
	}
	service.clock = func() time.Time { return base.Add(23 * time.Minute) }
	_, token, err = service.Login(ctx, login, password, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE staff_accounts SET active=false WHERE id=$1`, staffID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Validate(ctx, token); !errors.Is(err, ErrSession) {
		t.Fatalf("disabled account token: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE staff_accounts SET active=true WHERE id=$1`, staffID); err != nil {
		t.Fatal(err)
	}
	_, token, err = service.Login(ctx, login, password, "")
	if err != nil {
		t.Fatal(err)
	}
	service.clock = func() time.Time { return base.Add(84 * time.Minute) }
	if _, err := service.Validate(ctx, token); !errors.Is(err, ErrSession) {
		t.Fatalf("absolute expired token: %v", err)
	}
}
