//go:build integration

package auth

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"ayurflow/backend/internal/config"
	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSessionExpiryAfterLockWaitIntegration(t *testing.T) {
	for _, operation := range []string{"authenticate", "authenticate csrf", "validate", "logout"} {
		for _, boundary := range []string{"idle", "absolute"} {
			t.Run(operation+"/"+boundary, func(t *testing.T) {
				pool := testutil.Postgres(t)
				ctx, cancel := context.WithTimeout(t.Context(), 15*time.Second)
				defer cancel()
				base := time.Now().UTC().Truncate(time.Microsecond)
				idle, absolute := time.Hour, time.Minute
				if boundary == "idle" {
					idle, absolute = time.Minute, 2*time.Hour
				}
				service := NewService(pool, config.AuthPolicy{IdleTimeout: idle, AbsoluteTimeout: absolute})
				var clock atomic.Int64
				clock.Store(base.UnixNano())
				service.clock = func() time.Time { return time.Unix(0, clock.Load()).UTC() }
				token, hash, err := newSecret()
				if err != nil {
					t.Fatal(err)
				}
				csrf, csrfHash, err := newSecret()
				if err != nil {
					t.Fatal(err)
				}
				var actor string
				err = pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier,password_hash)
					VALUES('synthetic-lock-expiry','$argon2id$synthetic-fixture') RETURNING id::text`).Scan(&actor)
				if err != nil {
					t.Fatal(err)
				}
				_, err = pool.Exec(
					ctx,
					`INSERT INTO staff_sessions
					(staff_id,token_hash,csrf_token_hash,created_at,last_seen_at,expires_at)
					VALUES($1,$2,$3,$4,$4,$5)`,
					actor,
					hash[:],
					csrfHash[:],
					base,
					base.Add(absolute),
				)
				if err != nil {
					t.Fatal(err)
				}
				blocker, err := pool.Begin(ctx)
				if err != nil {
					t.Fatal(err)
				}
				defer blocker.Rollback(ctx)
				if _, err := blocker.Exec(ctx, `SELECT id FROM staff_sessions FOR UPDATE`); err != nil {
					t.Fatal(err)
				}
				result := make(chan error, 1)
				var worker sync.WaitGroup
				worker.Add(1)
				defer func() { cancel(); worker.Wait() }()
				go func() {
					defer worker.Done()
					var err error
					switch operation {
					case "authenticate":
						_, err = service.Authenticate(ctx, token)
					case "authenticate csrf":
						_, err = service.AuthenticateCSRF(ctx, token, csrf)
					case "validate":
						_, err = service.Validate(ctx, token)
					case "logout":
						err = service.Logout(ctx, token, csrf)
					}
					result <- err
				}()
				waitForAuthLock(
					t,
					ctx,
					pool,
					blocker.Conn().PgConn().PID(),
					"staff_sessions",
				)
				clock.Store(base.Add(time.Minute).UnixNano())
				if err := blocker.Rollback(ctx); err != nil {
					t.Fatal(err)
				}
				if err := <-result; !errors.Is(err, ErrSession) {
					t.Fatalf("expired session accepted after lock wait: %v", err)
				}
				var lastSeen time.Time
				var persistedCSRF []byte
				var revoked *time.Time
				err = pool.QueryRow(ctx, `SELECT last_seen_at,csrf_token_hash,revoked_at FROM staff_sessions`).
					Scan(&lastSeen, &persistedCSRF, &revoked)
				unchanged := lastSeen.Equal(base) && bytes.Equal(persistedCSRF, csrfHash[:]) && revoked == nil
				if err != nil || !unchanged {
					t.Fatalf("expiry rejection changed session state: error=%v", err)
				}
			})
		}
	}
}

func TestLoginClockAfterDatabaseWaitIntegration(t *testing.T) {
	for _, stage := range []string{"throttle lock", "credential lookup"} {
		t.Run(stage, func(t *testing.T) {
			pool := testutil.Postgres(t)
			ctx, cancel := context.WithTimeout(t.Context(), 15*time.Second)
			defer cancel()
			base := time.Now().UTC().Truncate(time.Microsecond)
			advanced := base.Add(2 * time.Minute)
			var clock atomic.Int64
			clock.Store(base.UnixNano())
			password := "synthetic-login-clock-password"
			hash, err := HashPassword(password)
			if err != nil {
				t.Fatal(err)
			}
			_, err = pool.Exec(ctx, `INSERT INTO staff_accounts(login_identifier,password_hash)
				VALUES('synthetic-login-clock',$1)`, hash)
			if err != nil {
				t.Fatal(err)
			}
			client := pool
			if stage == "credential lookup" {
				cfg := pool.Config()
				cfg.ConnConfig.Tracer = advanceCredentialClock{advance: func() { clock.Store(advanced.UnixNano()) }}
				client, err = pgxpool.NewWithConfig(ctx, cfg)
				if err != nil {
					t.Fatal(err)
				}
				defer client.Close()
			}
			service := NewService(client, config.AuthPolicy{
				IdleTimeout: 15 * time.Minute, AbsoluteTimeout: time.Hour,
				AttemptLimit: 2, AttemptWindow: time.Hour, BlockDuration: time.Minute,
			})
			service.clock = func() time.Time { return time.Unix(0, clock.Load()).UTC() }
			type outcome struct {
				session Session
				token   string
				err     error
			}
			result := make(chan outcome, 1)
			login := func() {
				session, token, err := service.Login(ctx, "synthetic-login-clock", password, "")
				result <- outcome{session: session, token: token, err: err}
			}
			if stage == "throttle lock" {
				key := sha256.Sum256([]byte("synthetic-login-clock"))
				_, err = pool.Exec(
					ctx,
					`INSERT INTO auth_login_attempts
					(identifier_hash,failures,window_started_at,blocked_until) VALUES($1,2,$2,$3)`,
					key[:],
					base,
					base.Add(time.Minute),
				)
				if err != nil {
					t.Fatal(err)
				}
				blocker, err := pool.Begin(ctx)
				if err != nil {
					t.Fatal(err)
				}
				defer blocker.Rollback(ctx)
				if _, err := blocker.Exec(ctx, `SELECT identifier_hash FROM auth_login_attempts FOR UPDATE`); err != nil {
					t.Fatal(err)
				}
				var worker sync.WaitGroup
				worker.Add(1)
				defer func() { cancel(); worker.Wait() }()
				go func() { defer worker.Done(); login() }()
				waitForAuthLock(
					t,
					ctx,
					pool,
					blocker.Conn().PgConn().PID(),
					"auth_login_attempts",
				)
				clock.Store(advanced.UnixNano())
				if err := blocker.Rollback(ctx); err != nil {
					t.Fatal(err)
				}
			} else {
				login()
			}
			loggedIn := <-result
			if loggedIn.err != nil || !loggedIn.session.ExpiresAt.Equal(advanced.Add(time.Hour)) {
				t.Fatalf("login used pre-wait clock: expires=%v error=%v", loggedIn.session.ExpiresAt, loggedIn.err)
			}
			var createdAt time.Time
			if err := pool.QueryRow(ctx, `SELECT created_at FROM staff_sessions`).Scan(&createdAt); err != nil || !createdAt.Equal(advanced) {
				t.Fatalf("new session was backdated: %v", err)
			}
			if loggedIn.session.Roles == nil {
				t.Fatal("empty login role list must be []")
			}
			authenticated, err := service.Authenticate(ctx, loggedIn.token)
			if err != nil || authenticated.Roles == nil {
				t.Fatalf("empty authenticated role list must be []: %v", err)
			}
		})
	}
}

type credentialClockKey struct{}

type advanceCredentialClock struct {
	advance func()
}

func (a advanceCredentialClock) TraceQueryStart(
	ctx context.Context,
	_ *pgx.Conn,
	data pgx.TraceQueryStartData,
) context.Context {
	credentialLookup := strings.Contains(data.SQL, "SELECT id::text, password_hash, active")
	return context.WithValue(ctx, credentialClockKey{}, credentialLookup)
}

func (a advanceCredentialClock) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, _ pgx.TraceQueryEndData) {
	if credentialLookup, _ := ctx.Value(credentialClockKey{}).(bool); credentialLookup {
		a.advance()
	}
}

func waitForAuthLock(
	t *testing.T,
	ctx context.Context,
	pool *pgxpool.Pool,
	blockerPID uint32,
	relation string,
) {
	t.Helper()
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()
	for {
		var waiting bool
		err := pool.QueryRow(
			ctx,
			`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
			WHERE datname=current_database() AND wait_event_type='Lock'
			AND $1::integer=ANY(pg_blocking_pids(pid)) AND query LIKE $2)`,
			int64(blockerPID),
			"%"+relation+"%",
		).Scan(&waiting)
		if err != nil {
			t.Fatal(err)
		}
		if waiting {
			return
		}
		select {
		case <-ctx.Done():
			t.Fatal("session operation did not reach the held database lock")
		case <-ticker.C:
		}
	}
}
