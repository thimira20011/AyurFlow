//go:build integration

package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"ayurflow/backend/internal/administration"
	"ayurflow/backend/internal/auth"
	"ayurflow/backend/internal/authorization"
	"ayurflow/backend/internal/config"
	"ayurflow/backend/internal/consultations"
	"ayurflow/backend/internal/patients"
	"ayurflow/backend/internal/testutil"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const protectedOrigin = "https://clinic.example"

type protectedFixture struct {
	pool     *pgxpool.Pool
	sessions *auth.Service
	router   *gin.Engine
	actor    string
	token    string
	csrf     string
}

func newProtectedFixture(t *testing.T) protectedFixture {
	t.Helper()
	gin.SetMode(gin.TestMode)
	pool := testutil.Postgres(t)
	password := "synthetic-password-for-http-tests"
	hash, err := auth.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	var actor string
	err = pool.QueryRow(t.Context(), `INSERT INTO staff_accounts(login_identifier,password_hash)
		VALUES('synthetic-reception',$1) RETURNING id::text`, hash).Scan(&actor)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(), `INSERT INTO staff_roles(staff_id,role_code) VALUES($1,'receptionist')`, actor); err != nil {
		t.Fatal(err)
	}
	sessions := auth.NewService(pool, config.AuthPolicy{
		Enabled: true, AllowedOrigin: protectedOrigin, IdleTimeout: 30 * time.Minute,
		AbsoluteTimeout: 8 * time.Hour, AttemptLimit: 5, AttemptWindow: 15 * time.Minute,
		BlockDuration: 15 * time.Minute,
	})
	session, token, err := sessions.Login(t.Context(), "synthetic-reception", password, "")
	if err != nil {
		t.Fatal(err)
	}
	service := patients.NewService(pool, &authorization.PatientPolicy{})
	clinical := consultations.NewService(pool, consultations.AssignedPolicy{})
	router := NewRouter(pool, AuthRoutes{Service: sessions, AllowedOrigin: protectedOrigin,
		Patients: service, Consultations: clinical, Signing: clinical})
	return protectedFixture{pool: pool, sessions: sessions, router: router, actor: actor, token: token, csrf: session.CSRFToken}
}

func protectedRequest(
	router http.Handler,
	method, path, token, csrf, body string,
	requestContexts ...context.Context,
) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	if len(requestContexts) > 0 {
		request = request.WithContext(requestContexts[0])
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", protectedOrigin)
	request.Header.Set("X-CSRF-Token", csrf)
	// Forged identity/roles must never override the server session.
	request.Header.Set("X-Staff-ID", "00000000-0000-0000-0000-000000000001")
	request.Header.Set("X-Role", "administrator")
	if token != "" {
		request.AddCookie(&http.Cookie{Name: sessionCookie, Value: token})
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func createProtectedPatient(t *testing.T, f protectedFixture) patients.Patient {
	t.Helper()
	response := protectedRequest(f.router, "POST", "/api/v1/patients", f.token, f.csrf,
		`{"displayName":"Synthetic ආයු patient","phone":"0700000000","identity":{"type":"NIC","value":"synthetic-123"}}`)
	if response.Code != http.StatusCreated {
		t.Fatalf("create failed: %d %s", response.Code, response.Body.String())
	}
	var patient patients.Patient
	if err := json.Unmarshal(response.Body.Bytes(), &patient); err != nil {
		t.Fatal(err)
	}
	return patient
}

func TestProtectedPatientFlowIntegration(t *testing.T) {
	f := newProtectedFixture(t)
	for _, tc := range []struct {
		name, method, path, token, csrf, body string
		want                                  int
	}{
		{name: "unauthenticated", method: "GET", path: "/api/v1/patients?q=Synthetic", want: 401},
		{name: "missing csrf", method: "POST", path: "/api/v1/patients", token: f.token, body: `{"displayName":"rejected"}`, want: 403},
		{name: "wrong csrf", method: "POST", path: "/api/v1/patients", token: f.token, csrf: f.token, body: `{"displayName":"rejected"}`, want: 403},
		{name: "unknown field", method: "POST", path: "/api/v1/patients", token: f.token, csrf: f.csrf, body: `{"displayName":"rejected","actorId":"forged"}`, want: 400},
		{name: "trailing document", method: "POST", path: "/api/v1/patients", token: f.token, csrf: f.csrf, body: `{"displayName":"rejected"} {}`, want: 400},
		{name: "null document", method: "POST", path: "/api/v1/patients", token: f.token, csrf: f.csrf, body: `null`, want: 400},
		{name: "oversized body", method: "POST", path: "/api/v1/patients", token: f.token, csrf: f.csrf, body: `{"displayName":"` + strings.Repeat("x", 17000) + `"}`, want: 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response := protectedRequest(f.router, tc.method, tc.path, tc.token, tc.csrf, tc.body)
			if response.Code != tc.want {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
		})
	}
	var count int
	if err := f.pool.QueryRow(t.Context(), `SELECT count(*) FROM patients`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("rejected requests changed state: count=%d err=%v", count, err)
	}
	patient := createProtectedPatient(t, f)
	response := protectedRequest(f.router, "GET", "/api/v1/patients/"+patient.ID, f.token, "", "")
	if response.Code != 200 || !strings.Contains(response.Body.String(), "Synthetic") {
		t.Fatalf("protected read: %d %s", response.Code, response.Body.String())
	}
	response = protectedRequest(f.router, "GET", "/api/v1/patients?q=Synthetic", f.token, "", "")
	if response.Code != 200 || !strings.Contains(response.Body.String(), patient.ID) {
		t.Fatalf("protected search: %d %s", response.Code, response.Body.String())
	}
	// Ordinary reads did not rotate the token: the original token still authorizes a patch.
	response = protectedRequest(f.router, "PATCH", "/api/v1/patients/"+patient.ID, f.token, f.csrf,
		`{"version":1,"displayName":"Synthetic updated","phone":null,"identity":null}`)
	if response.Code != 200 {
		t.Fatalf("protected update: %d %s", response.Code, response.Body.String())
	}
	response = protectedRequest(f.router, "PATCH", "/api/v1/patients/"+patient.ID, f.token, f.csrf,
		`{"version":1,"displayName":"stale must not persist"}`)
	if response.Code != 409 {
		t.Fatalf("stale version: %d", response.Code)
	}
	var auditActor string
	err := f.pool.QueryRow(t.Context(), `SELECT actor_id::text FROM audit_events WHERE action='patient.updated'`).Scan(&auditActor)
	if err != nil || auditActor != f.actor {
		t.Fatalf("forged identity changed audit actor: %v", err)
	}
	if _, err := f.pool.Exec(t.Context(), `DELETE FROM staff_roles WHERE staff_id=$1`, f.actor); err != nil {
		t.Fatal(err)
	}
	response = protectedRequest(f.router, "GET", "/api/v1/patients?q=Synthetic", f.token, "", "")
	if response.Code != 403 || strings.Contains(response.Body.String(), patient.ID) {
		t.Fatalf("revoked role retained search access: %d", response.Code)
	}
}

func TestProtectedSessionRejectionIntegration(t *testing.T) {
	for _, tc := range []struct {
		name, sql string
	}{
		{name: "disabled account", sql: `UPDATE staff_accounts SET active=false`},
		{name: "revoked session", sql: `UPDATE staff_sessions SET revoked_at=now()`},
		{name: "absolute expiry", sql: `UPDATE staff_sessions SET created_at=now()-interval '9 hours', expires_at=now()-interval '1 hour'`},
		{name: "idle expiry", sql: `UPDATE staff_sessions SET last_seen_at=now()-interval '31 minutes'`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newProtectedFixture(t)
			if _, err := f.pool.Exec(t.Context(), tc.sql); err != nil {
				t.Fatal(err)
			}
			response := protectedRequest(f.router, "GET", "/api/v1/patients?q=Synthetic", f.token, "", "")
			if response.Code != 401 {
				t.Fatalf("inactive session allowed: %d %s", response.Code, response.Body.String())
			}
		})
	}
}

func TestProtectedConcurrentRequestsIntegration(t *testing.T) {
	f := newProtectedFixture(t)
	patient := createProtectedPatient(t, f)
	ctx, cancel := context.WithTimeout(t.Context(), 15*time.Second)
	defer cancel()
	var workers sync.WaitGroup
	results := make(chan int, 2)
	start := make(chan struct{})
	for _, method := range []string{"GET", "PATCH"} {
		workers.Add(1)
		go func() {
			defer workers.Done()
			<-start
			response := protectedRequest(f.router, method, "/api/v1/patients/"+patient.ID, f.token, f.csrf,
				`{"version":1,"displayName":"Synthetic concurrent update"}`, ctx)
			results <- response.Code
		}()
	}
	close(start)
	workers.Wait()
	for range 2 {
		if status := <-results; status != 200 {
			t.Fatalf("concurrent request invalidated the CSRF token: status=%d", status)
		}
	}
}

func TestProtectedAuditFailureIntegration(t *testing.T) {
	f := newProtectedFixture(t)
	patient := createProtectedPatient(t, f)
	_, err := f.pool.Exec(t.Context(), `CREATE FUNCTION reject_http_audit() RETURNS trigger
		LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic secret failure'; END; $$;
		CREATE TRIGGER reject_http_audit BEFORE INSERT ON audit_events
		FOR EACH ROW EXECUTE FUNCTION reject_http_audit()`)
	if err != nil {
		t.Fatal(err)
	}
	response := protectedRequest(f.router, "PATCH", "/api/v1/patients/"+patient.ID, f.token, f.csrf,
		`{"version":1,"displayName":"must roll back"}`)
	if response.Code != 503 || strings.Contains(response.Body.String(), "synthetic secret") {
		t.Fatalf("unsafe failed audit response: %d %s", response.Code, response.Body.String())
	}
	var name string
	var version int64
	err = f.pool.QueryRow(t.Context(), `SELECT display_name,record_version FROM patients WHERE id=$1`, patient.ID).
		Scan(&name, &version)
	if err != nil || name != patient.DisplayName || version != 1 {
		t.Fatalf("failed audit changed prior state: name=%s version=%d err=%v", name, version, err)
	}
}

type httpFixtureAssignment struct {
	actor, patient string
}

func (f httpFixtureAssignment) AuthorizeRecord(_ context.Context, _ pgx.Tx, actor string, _ authorization.Action, target authorization.Resource) error {
	if actor == f.actor && target.Kind == "patient" && target.ID == f.patient {
		return nil
	}
	return authorization.ErrForbidden
}

func TestClinicalRouteBoundaryIntegration(t *testing.T) {
	f := newProtectedFixture(t)
	patient := createProtectedPatient(t, f)
	// Test-only route proves the reusable gate. There is no production notes
	// handler or invented consultation/assignment table in this AUTH-03 slice.
	gate := &authorization.Authorizer{Records: httpFixtureAssignment{actor: f.actor, patient: patient.ID}}
	f.router.GET("/test/clinical/:id", RequireSession(f.sessions, protectedOrigin), func(c *gin.Context) {
		err := pgx.BeginFunc(c.Request.Context(), f.pool, func(tx pgx.Tx) error {
			return gate.Require(c.Request.Context(), tx, ActorID(c), authorization.ClinicalRead,
				authorization.Resource{Kind: "patient", ID: c.Param("id")})
		})
		if err != nil {
			c.Status(404)
			return
		}
		c.String(200, "synthetic clinical fixture")
	})
	for _, tc := range []struct {
		name, role, target string
		want               int
	}{
		{name: "administrator alone", role: "administrator", target: patient.ID, want: 404},
		{name: "reception", role: "receptionist", target: patient.ID, want: 404},
		{name: "assigned clinician", role: "clinician", target: patient.ID, want: 200},
		{name: "different patient", role: "clinician", target: "10000000-0000-4000-8000-000000000001", want: 404},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := f.pool.Exec(t.Context(), `DELETE FROM staff_roles WHERE staff_id=$1`, f.actor)
			if err == nil {
				_, err = f.pool.Exec(t.Context(), `INSERT INTO staff_roles(staff_id,role_code) VALUES($1,$2)`, f.actor, tc.role)
			}
			if err != nil {
				t.Fatal(err)
			}
			response := protectedRequest(f.router, "GET", "/test/clinical/"+tc.target, f.token, "", "")
			if response.Code != tc.want || (tc.want != 200 && strings.Contains(response.Body.String(), "synthetic clinical")) {
				t.Fatalf("clinical boundary failed: status=%d", response.Code)
			}
		})
	}
}

func TestAdministrationRouteBoundaryIntegration(t *testing.T) {
	f := newProtectedFixture(t)
	f.router = NewRouter(f.pool, AuthRoutes{Service: f.sessions, AllowedOrigin: protectedOrigin, Administration: administration.NewService(f.pool)})
	response := protectedRequest(f.router, "GET", "/api/v1/admin/staff", f.token, "", "")
	if response.Code != 403 {
		t.Fatalf("non-admin list status=%d", response.Code)
	}
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO staff_roles(staff_id,role_code) VALUES($1,'administrator')`, f.actor); err != nil {
		t.Fatal(err)
	}
	const password = "synthetic-initial-password"
	body := `{"loginIdentifier":"synthetic-managed","password":"` + password + `","roles":["billing"]}`
	response = protectedRequest(f.router, "POST", "/api/v1/admin/staff", f.token, "", body)
	if response.Code != 403 {
		t.Fatal("admin creation bypassed CSRF")
	}
	response = protectedRequest(f.router, "POST", "/api/v1/admin/staff", f.token, f.csrf, body)
	if response.Code != 201 {
		t.Fatalf("create status=%d body=%s", response.Code, response.Body.String())
	}
	if strings.Contains(response.Body.String(), password) || strings.Contains(response.Body.String(), "argon2") {
		t.Fatal("created response leaked credentials")
	}
	var staff administration.Staff
	if err := json.Unmarshal(response.Body.Bytes(), &staff); err != nil {
		t.Fatal(err)
	}
	response = protectedRequest(f.router, "PUT", "/api/v1/admin/staff/"+staff.ID+"/roles", f.token, f.csrf, `{"roles":["clinician"]}`)
	if response.Code != 200 {
		t.Fatalf("roles status=%d body=%s", response.Code, response.Body.String())
	}
	response = protectedRequest(f.router, "POST", "/api/v1/admin/staff/"+strings.ToUpper(f.actor)+"/disable", f.token, f.csrf, "")
	if response.Code != 409 {
		t.Fatal("self-disable route bypass")
	}
	response = protectedRequest(f.router, "POST", "/api/v1/admin/staff/"+staff.ID+"/disable", f.token, f.csrf, "")
	if response.Code != 204 {
		t.Fatalf("disable status=%d body=%s", response.Code, response.Body.String())
	}
	response = protectedRequest(f.router, "GET", "/api/v1/admin/staff", f.token, "", "")
	if response.Code != 200 || strings.Contains(response.Body.String(), password) || strings.Contains(response.Body.String(), "argon2") {
		t.Fatal("unsafe staff list")
	}
}

func TestDisableAndAuthenticationLockOrderIntegration(t *testing.T) {
	f := newProtectedFixture(t)
	ctx, cancel := context.WithTimeout(t.Context(), 15*time.Second)
	defer cancel()
	var otherAdmin string
	err := f.pool.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier,password_hash) VALUES('synthetic-disable-owner','$argon2id$synthetic-fixture') RETURNING id::text`).Scan(&otherAdmin)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, `INSERT INTO staff_roles(staff_id,role_code) VALUES($1,'administrator')`, otherAdmin); err != nil {
		t.Fatal(err)
	}
	blocker, err := f.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer blocker.Rollback(ctx)
	if _, err := blocker.Exec(ctx, `SELECT id FROM staff_sessions FOR UPDATE`); err != nil {
		t.Fatal(err)
	}
	results := make(chan error, 2)
	var workers sync.WaitGroup
	defer func() { cancel(); workers.Wait() }()
	workers.Add(1)
	go func() { defer workers.Done(); _, err := f.sessions.Authenticate(ctx, f.token); results <- err }()
	authPID := waitForBlockingPID(t, ctx, f.pool, blocker.Conn().PgConn().PID())
	workers.Add(1)
	go func() {
		defer workers.Done()
		results <- administration.NewService(f.pool).Disable(ctx, otherAdmin, f.actor)
	}()
	// Disable must wait on authentication's account lock, not hold the account
	// while waiting for the session row already requested by authentication.
	waitForBlockingPID(t, ctx, f.pool, authPID)
	if err := blocker.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		select {
		case err := <-results:
			if err != nil {
				t.Fatal(err)
			}
		case <-ctx.Done():
			t.Fatal("disable/authentication deadlocked")
		}
	}
	if _, err := f.sessions.Authenticate(ctx, f.token); err != auth.ErrSession {
		t.Fatalf("disabled account retained session: %v", err)
	}
}

func waitForBlockingPID(t *testing.T, ctx context.Context, pool *pgxpool.Pool, blocker uint32) uint32 {
	t.Helper()
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()
	for {
		var pid uint32
		err := pool.QueryRow(ctx, `SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND $1::integer=ANY(pg_blocking_pids(pid)) LIMIT 1`, int64(blocker)).Scan(&pid)
		if err == nil {
			return pid
		}
		if err != pgx.ErrNoRows {
			t.Fatal(err)
		}
		select {
		case <-ctx.Done():
			t.Fatal("expected database lock wait not observed")
		case <-ticker.C:
		}
	}
}
