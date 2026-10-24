package main

import (
	"context"
	"errors"
	"net/http"
)

func shutdownServer(ctx context.Context, server *http.Server, cancelRequests context.CancelFunc) error {
	if err := server.Shutdown(ctx); err != nil {
		// Shutdown leaves active connections open after its grace period expires.
		cancelRequests()
		return errors.Join(err, server.Close())
	}
	return nil
}
