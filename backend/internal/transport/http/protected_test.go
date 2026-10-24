package http

import (
	"context"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	"ayurflow/backend/internal/auth"

	"github.com/gin-gonic/gin"
)

type protectedSessions struct {
	err error
}

func (s protectedSessions) Authenticate(context.Context, string) (auth.Session, error) {
	return auth.Session{StaffID: "server-selected-actor"}, s.err
}

func (s protectedSessions) AuthenticateCSRF(ctx context.Context, token, csrf string) (auth.Session, error) {
	if csrf != "expected-csrf" {
		return auth.Session{}, auth.ErrCSRF
	}
	return s.Authenticate(ctx, token)
}

func TestRequireSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		name, method, origin, csrf, cookie, fetchSite string
		err                                           error
		want                                          int
	}{
		{name: "missing cookie", method: "GET", want: 401},
		{name: "bearer cannot replace cookie", method: "GET", want: 401},
		{name: "duplicate session cookies", method: "GET", cookie: sessionCookie + "=one; " + sessionCookie + "=two", want: 401},
		{name: "read", method: "GET", cookie: sessionCookie + "=opaque", want: 204},
		{name: "cross-site read", method: "GET", cookie: sessionCookie + "=opaque", fetchSite: "cross-site", want: 403},
		{name: "write missing origin", method: "POST", cookie: sessionCookie + "=opaque", csrf: "expected-csrf", want: 403},
		{name: "suffix origin", method: "PATCH", origin: "https://clinic.example.evil", cookie: sessionCookie + "=opaque", csrf: "expected-csrf", want: 403},
		{name: "null origin", method: "DELETE", origin: "null", cookie: sessionCookie + "=opaque", csrf: "expected-csrf", want: 403},
		{name: "missing csrf", method: "POST", origin: "https://clinic.example", cookie: sessionCookie + "=opaque", want: 403},
		{name: "wrong csrf", method: "POST", origin: "https://clinic.example", cookie: sessionCookie + "=opaque", csrf: "wrong", want: 403},
		{name: "write", method: "POST", origin: "https://clinic.example", cookie: sessionCookie + "=opaque", csrf: "expected-csrf", want: 204},
		{name: "revoked", method: "GET", cookie: sessionCookie + "=opaque", err: auth.ErrSession, want: 401},
		{name: "database unavailable", method: "GET", cookie: sessionCookie + "=opaque", err: errors.New("private database error"), want: 503},
	} {
		t.Run(tc.name, func(t *testing.T) {
			router := gin.New()
			router.Use(RequireSession(protectedSessions{err: tc.err}, "https://clinic.example"))
			router.Any("/protected", func(c *gin.Context) {
				if ActorID(c) != "server-selected-actor" {
					t.Error("actor did not come from validated session")
				}
				c.Status(204)
			})
			request := httptest.NewRequest(tc.method, "/protected", nil)
			request.Header.Set("Cookie", tc.cookie)
			request.Header.Set("Origin", tc.origin)
			request.Header.Set("X-CSRF-Token", tc.csrf)
			request.Header.Set("Sec-Fetch-Site", tc.fetchSite)
			request.Header.Set("Authorization", "Bearer forged-token")
			request.Header.Set("X-Staff-ID", "attacker")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != tc.want || response.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
			if strings.Contains(response.Body.String(), "private database") || strings.Contains(response.Body.String(), "opaque") {
				t.Fatal("error exposed internals or session secret")
			}
		})
	}
}
