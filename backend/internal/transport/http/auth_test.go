package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"ayurflow/backend/internal/auth"

	"github.com/gin-gonic/gin"
)

type fakeSessions struct {
	loginError  error
	logoutError error
	lastToken   string
	lastCSRF    string
}

func (f *fakeSessions) Login(context.Context, string, string, string) (auth.Session, string, error) {
	if f.loginError != nil {
		return auth.Session{}, "", f.loginError
	}
	return auth.Session{StaffID: "synthetic-staff", Roles: []string{"receptionist"},
		CSRFToken: "csrf", ExpiresAt: time.Now().Add(time.Hour)}, "opaque-token", nil
}

func (f *fakeSessions) Validate(context.Context, string) (auth.Session, error) {
	return auth.Session{StaffID: "synthetic-staff", Roles: []string{}, CSRFToken: "rotated"}, nil
}

func (f *fakeSessions) Authenticate(ctx context.Context, token string) (auth.Session, error) {
	return f.Validate(ctx, token)
}

func (f *fakeSessions) AuthenticateCSRF(ctx context.Context, token, _ string) (auth.Session, error) {
	return f.Validate(ctx, token)
}

func (f *fakeSessions) Logout(_ context.Context, token, csrf string) error {
	f.lastToken, f.lastCSRF = token, csrf
	return f.logoutError
}

func TestLoginRequiresOriginAndSetsProtectedCookie(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service := &fakeSessions{}
	router := NewRouter(nil, AuthRoutes{Service: service, AllowedOrigin: "https://clinic.example"})
	for _, tc := range []struct {
		name   string
		origin string
		want   int
	}{
		{name: "missing origin", want: http.StatusForbidden},
		{name: "foreign origin", origin: "https://evil.example", want: http.StatusForbidden},
		{name: "allowed origin", origin: "https://clinic.example", want: http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login",
				strings.NewReader(`{"loginIdentifier":"user","password":"password"}`))
			request.Header.Set("Origin", tc.origin)
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != tc.want {
				t.Fatalf("status = %d, want %d", response.Code, tc.want)
			}
			if tc.want == http.StatusOK {
				cookie := response.Result().Cookies()[0]
				if cookie.Name != sessionCookie || !cookie.Secure || !cookie.HttpOnly ||
					cookie.SameSite != http.SameSiteLaxMode || cookie.Path != "/" {
					t.Fatalf("unsafe session cookie: %+v", cookie)
				}
			}
		})
	}
}

func TestLoginFailureIsGeneric(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service := &fakeSessions{loginError: auth.ErrCredentials}
	router := NewRouter(nil, AuthRoutes{Service: service, AllowedOrigin: "https://clinic.example"})
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login",
		strings.NewReader(`{"loginIdentifier":"missing","password":"wrong"}`))
	request.Header.Set("Origin", "https://clinic.example")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized || strings.Contains(response.Body.String(), "missing") ||
		strings.Contains(response.Body.String(), "wrong") {
		t.Fatalf("unsafe login response: %d %s", response.Code, response.Body.String())
	}
}

func TestAuthFailuresArePrivateAndUncacheable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const secret = "synthetic-private-error-canary"
	for _, tc := range []struct {
		name, path, body string
		service          *fakeSessions
		want             int
	}{
		{name: "credentials", path: "login", body: `{"loginIdentifier":"` + secret + `","password":"` + secret + `"}`,
			service: &fakeSessions{loginError: auth.ErrCredentials}, want: http.StatusUnauthorized},
		{name: "login infrastructure", path: "login", body: `{"loginIdentifier":"staff","password":"` + secret + `"}`,
			service: &fakeSessions{loginError: errors.New(secret)}, want: http.StatusServiceUnavailable},
		{name: "malformed login", path: "login", body: `{"password":"` + secret,
			service: &fakeSessions{}, want: http.StatusBadRequest},
		{name: "logout infrastructure", path: "logout", service: &fakeSessions{logoutError: errors.New(secret)},
			want: http.StatusServiceUnavailable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			router := NewRouter(nil, AuthRoutes{Service: tc.service, AllowedOrigin: "https://clinic.example"})
			request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/"+tc.path, strings.NewReader(tc.body))
			request.Header.Set("Origin", "https://clinic.example")
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("X-CSRF-Token", secret)
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: secret})
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != tc.want || response.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("status=%d cache=%q", response.Code, response.Header().Get("Cache-Control"))
			}
			if strings.Contains(response.Body.String(), secret) || response.Header().Get("Set-Cookie") != "" {
				t.Fatal("failed authentication exposed secrets or changed the session cookie")
			}
		})
	}
}

func TestLogoutRequiresCSRF(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service := &fakeSessions{}
	router := NewRouter(nil, AuthRoutes{Service: service, AllowedOrigin: "https://clinic.example"})
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	request.Header.Set("Origin", "https://clinic.example")
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: "opaque-token"})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden || service.lastToken != "" {
		t.Fatalf("missing CSRF: status=%d called=%q", response.Code, service.lastToken)
	}
	request.Header.Set("X-CSRF-Token", "csrf")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent || service.lastToken != "opaque-token" || service.lastCSRF != "csrf" {
		t.Fatalf("logout failed: status=%d token=%q csrf=%q", response.Code, service.lastToken, service.lastCSRF)
	}
	service.logoutError = errors.New("private database error")
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusServiceUnavailable || strings.Contains(response.Body.String(), "private") {
		t.Fatalf("database detail leaked: %d %s", response.Code, response.Body.String())
	}
	service.logoutError = auth.ErrCSRF
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden || response.Header().Get("Set-Cookie") != "" {
		t.Fatal("CSRF rejection must not clear a valid session cookie or claim successful logout")
	}
}
