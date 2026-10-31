package http

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRecoveryDoesNotExposeRequestSecrets(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var logs bytes.Buffer
	previousOutput, previousError := gin.DefaultWriter, gin.DefaultErrorWriter
	gin.DefaultWriter, gin.DefaultErrorWriter = &logs, &logs
	t.Cleanup(func() { gin.DefaultWriter, gin.DefaultErrorWriter = previousOutput, previousError })
	router := NewRouter(nil)
	const secret = "synthetic-secret-canary"
	router.POST("/panic-test", func(c *gin.Context) { panic(secret) })
	request := httptest.NewRequest(http.MethodPost, "/panic-test", strings.NewReader(secret))
	request.Header.Set("Cookie", sessionCookie+"="+secret)
	request.Header.Set("X-CSRF-Token", secret)
	request.Header.Set("Authorization", "Bearer "+secret)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusInternalServerError || !strings.Contains(response.Body.String(), "internal_error") {
		t.Fatalf("recovery status=%d body=%s", response.Code, response.Body.String())
	}
	if strings.Contains(response.Body.String(), secret) || strings.Contains(logs.String(), secret) {
		t.Fatal("panic recovery disclosed a synthetic request secret")
	}
}

type unavailableDB struct{}

func (unavailableDB) Ping(context.Context) error { return errors.New("private database detail") }

func TestDatabaseOutageKeepsLivenessButFailsReadiness(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := NewRouter(unavailableDB{})
	for _, tc := range []struct {
		path string
		want int
	}{
		{"/api/v1/health", http.StatusOK},
		{"/api/v1/ready", http.StatusServiceUnavailable},
		{"/api/v1/patients", http.StatusNotFound},
	} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, tc.path, nil))
		if response.Code != tc.want {
			t.Fatalf("%s: got %d, want %d", tc.path, response.Code, tc.want)
		}
		if strings.Contains(response.Body.String(), "private database detail") {
			t.Fatal("database details leaked to the response")
		}
	}
}
