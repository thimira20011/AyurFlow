package http

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"ayurflow/backend/internal/auth"

	"github.com/gin-gonic/gin"
)

const sessionCookie = "__Host-ayurflow_session"

type SessionService interface {
	SessionAuthenticator
	Login(context.Context, string, string, string) (auth.Session, string, error)
	Validate(context.Context, string) (auth.Session, error)
	Logout(context.Context, string, string) error
}

type AuthRoutes struct {
	Service        SessionService
	AllowedOrigin  string
	Patients       PatientService
	Consultations  ConsultationDraftService
	Signing        ConsultationSigningService
	Administration AdministrationService
	Billing        BillingService
}

func registerAuth(api *gin.RouterGroup, routes AuthRoutes) {
	group := api.Group("/auth")
	group.Use(func(c *gin.Context) { c.Header("Cache-Control", "no-store") })
	group.POST("/login", func(c *gin.Context) {
		if !sameOrigin(c, routes.AllowedOrigin) {
			c.JSON(http.StatusForbidden, failure("forbidden", "Request origin is not allowed."))
			return
		}
		var input struct {
			LoginIdentifier string `json:"loginIdentifier" binding:"required"`
			Password        string `json:"password" binding:"required"`
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, failure("bad_request", "Invalid login request."))
			return
		}
		previousToken, _ := c.Cookie(sessionCookie)
		session, token, err := routes.Service.Login(
			c.Request.Context(), input.LoginIdentifier, input.Password, previousToken,
		)
		if errors.Is(err, auth.ErrCredentials) {
			c.JSON(http.StatusUnauthorized, failure("invalid_credentials", "Invalid login identifier or password."))
			return
		}
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, failure("unavailable", "Login is unavailable."))
			return
		}
		setSessionCookie(c, token)
		c.JSON(http.StatusOK, session)
	})
	group.GET("/session", func(c *gin.Context) {
		if c.GetHeader("Sec-Fetch-Site") == "cross-site" {
			c.JSON(http.StatusForbidden, failure("forbidden", "Cross-site requests are not allowed."))
			return
		}
		token, err := c.Cookie(sessionCookie)
		if err != nil {
			c.JSON(http.StatusUnauthorized, failure("unauthenticated", "Sign in is required."))
			return
		}
		session, err := routes.Service.Validate(c.Request.Context(), token)
		if errors.Is(err, auth.ErrSession) {
			clearSessionCookie(c)
			c.JSON(http.StatusUnauthorized, failure("unauthenticated", "Sign in is required."))
			return
		}
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, failure("unavailable", "Session lookup is unavailable."))
			return
		}
		c.JSON(http.StatusOK, session)
	})
	group.POST("/logout", func(c *gin.Context) {
		if !sameOrigin(c, routes.AllowedOrigin) {
			c.JSON(http.StatusForbidden, failure("forbidden", "Request origin is not allowed."))
			return
		}
		token, err := c.Cookie(sessionCookie)
		if err != nil {
			c.JSON(http.StatusUnauthorized, failure("unauthenticated", "Sign in is required."))
			return
		}
		csrf := c.GetHeader("X-CSRF-Token")
		if csrf == "" {
			c.JSON(http.StatusForbidden, failure("csrf_failed", "CSRF token is required."))
			return
		}
		err = routes.Service.Logout(c.Request.Context(), token, csrf)
		if errors.Is(err, auth.ErrCSRF) {
			c.JSON(http.StatusForbidden, failure("csrf_failed", "Refresh your session and retry."))
			return
		}
		if errors.Is(err, auth.ErrSession) {
			clearSessionCookie(c)
			c.JSON(http.StatusUnauthorized, failure("unauthenticated", "Sign in is required."))
			return
		}
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, failure("unavailable", "Logout is unavailable."))
			return
		}
		clearSessionCookie(c)
		c.Status(http.StatusNoContent)
	})
}

func sameOrigin(c *gin.Context, allowed string) bool {
	origin := c.GetHeader("Origin")
	return origin != "" && origin == allowed && !strings.ContainsAny(origin, "\r\n")
}

func setSessionCookie(c *gin.Context, token string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name: sessionCookie, Value: token, Path: "/", Secure: true,
		HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
}

func clearSessionCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name: sessionCookie, Path: "/", MaxAge: -1, Secure: true,
		HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
}
