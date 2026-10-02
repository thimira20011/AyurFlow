package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

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
