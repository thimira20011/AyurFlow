package http

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
)

// Leave five seconds of the server's write timeout for error/response delivery.
const requestTimeout = 10 * time.Second

func requestDeadline(timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
		defer cancel()
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
