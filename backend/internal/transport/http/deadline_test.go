package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRequestDeadlineCancelsBlockedHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(requestDeadline(10 * time.Millisecond))
	router.GET("/blocked", func(c *gin.Context) {
		deadline, ok := c.Request.Context().Deadline()
		if !ok || time.Until(deadline) > 10*time.Millisecond {
			t.Fatal("blocked handler did not receive its request deadline")
		}
		<-c.Request.Context().Done()
		if !errors.Is(c.Request.Context().Err(), context.DeadlineExceeded) {
			t.Error("request did not receive deadline cancellation")
		}
		c.Status(http.StatusServiceUnavailable)
	})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/blocked", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("got status %d", response.Code)
	}
}

func TestRequestDeadlinePreservesParentCancellation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	parent, cancel := context.WithCancel(t.Context())
	cancel()
	router := gin.New()
	router.Use(requestDeadline(time.Hour))
	router.GET("/canceled", func(c *gin.Context) {
		if !errors.Is(c.Request.Context().Err(), context.Canceled) {
			t.Fatal("middleware detached the parent cancellation")
		}
		c.Status(http.StatusServiceUnavailable)
	})
	request := httptest.NewRequest(http.MethodGet, "/canceled", nil).WithContext(parent)
	router.ServeHTTP(httptest.NewRecorder(), request)
}

func TestRouterInstallsRequestDeadline(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := NewRouter(nil)
	router.GET("/deadline", func(c *gin.Context) {
		deadline, ok := c.Request.Context().Deadline()
		if !ok || time.Until(deadline) > requestTimeout {
			t.Fatal("router did not install the bounded application deadline")
		}
		c.Status(http.StatusNoContent)
	})
	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/deadline", nil))
}
