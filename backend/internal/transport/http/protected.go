package http

import (
	"context"
	"errors"
	"net/http"

	"ayurflow/backend/internal/auth"

	"github.com/gin-gonic/gin"
)

const actorKey = "ayurflow.authenticated.staff"

type SessionAuthenticator interface {
	Authenticate(context.Context, string) (auth.Session, error)
	AuthenticateCSRF(context.Context, string, string) (auth.Session, error)
}

// RequireSession is the boundary for every protected route group. Services must
// still check role and record access inside their own business transaction.
func RequireSession(service SessionAuthenticator, allowedOrigin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		if service == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, failure("unavailable", "Authentication is unavailable."))
			return
		}
		unsafe := c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead &&
			c.Request.Method != http.MethodOptions
		if c.GetHeader("Sec-Fetch-Site") == "cross-site" || (unsafe && !sameOrigin(c, allowedOrigin)) {
			c.AbortWithStatusJSON(http.StatusForbidden, failure("forbidden", "Request origin is not allowed."))
			return
		}
		token, err := c.Cookie(sessionCookie)
		count := 0
		for _, cookie := range c.Request.Cookies() {
			if cookie.Name == sessionCookie {
				count++
			}
		}
		if err != nil || token == "" || count != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, failure("unauthenticated", "Sign in is required."))
			return
		}
		var session auth.Session
		if unsafe {
			session, err = service.AuthenticateCSRF(c.Request.Context(), token, c.GetHeader("X-CSRF-Token"))
		} else {
			session, err = service.Authenticate(c.Request.Context(), token)
		}
		switch {
		case errors.Is(err, auth.ErrSession):
			clearSessionCookie(c)
			c.AbortWithStatusJSON(http.StatusUnauthorized, failure("unauthenticated", "Sign in is required."))
		case errors.Is(err, auth.ErrCSRF):
			c.AbortWithStatusJSON(http.StatusForbidden, failure("csrf_failed", "Refresh your session and retry."))
		case err != nil:
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, failure("unavailable", "Authentication is unavailable."))
		case session.StaffID == "":
			c.AbortWithStatusJSON(http.StatusUnauthorized, failure("unauthenticated", "Sign in is required."))
		default:
			c.Set(actorKey, session.StaffID)
			c.Next()
		}
	}
}

// ActorID returns only the server-validated identity installed by RequireSession.
func ActorID(c *gin.Context) string {
	return c.GetString(actorKey)
}
