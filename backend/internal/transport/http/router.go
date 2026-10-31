package http

import (
	"context"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type DatabaseChecker interface {
	Ping(context.Context) error
}

type ErrorResponse struct {
	Error APIError `json:"error"`
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func NewRouter(db DatabaseChecker, authRoutes ...AuthRoutes) *gin.Engine {
	router := gin.New()
	// Recovery must not print request headers, cookies or clinical payloads.
	router.Use(gin.CustomRecoveryWithWriter(io.Discard, func(c *gin.Context, _ any) {
		c.AbortWithStatusJSON(http.StatusInternalServerError, failure("internal_error", "The request could not be completed."))
	}))
	router.Use(requestDeadline(requestTimeout))
	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, failure("not_found", "The requested resource was not found."))
	})
	api := router.Group("/api/v1")
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	api.GET("/ready", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if db == nil || db.Ping(ctx) != nil {
			c.JSON(http.StatusServiceUnavailable, failure("not_ready", "The database is unavailable."))
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})
	if len(authRoutes) > 0 && authRoutes[0].Service != nil {
		registerAuth(api, authRoutes[0])
		protected := api.Group("")
		protected.Use(RequireSession(authRoutes[0].Service, authRoutes[0].AllowedOrigin))
		if authRoutes[0].Patients != nil {
			registerPatients(protected, authRoutes[0].Patients)
		}
		if authRoutes[0].Consultations != nil {
			registerConsultationDrafts(protected, authRoutes[0].Consultations)
		}
		if authRoutes[0].Signing != nil {
			registerConsultationSigning(protected, authRoutes[0].Signing)
		}
		if authRoutes[0].Administration != nil {
			registerAdministration(protected, authRoutes[0].Administration)
		}
		if authRoutes[0].Billing != nil {
			registerBilling(protected, authRoutes[0].Billing)
		}
	}
	// Register business routes only after authentication, CSRF and record access exist.
	return router
}

func failure(code, message string) ErrorResponse {
	return ErrorResponse{Error: APIError{Code: code, Message: message}}
}
