package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"ayurflow/backend/internal/config"
	"ayurflow/backend/internal/platform/database"
	transport "ayurflow/backend/internal/transport/http"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := run(); err != nil {
		// Do not print configuration errors containing database credentials.
		slog.Error("API stopped; check configuration and database connectivity")
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	gin.SetMode(gin.ReleaseMode)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pool, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	router := transport.NewRouter(pool)
	if err := router.SetTrustedProxies(nil); err != nil {
		return err
	}
	server := &http.Server{
		Addr: cfg.HTTPAddr, Handler: router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second, WriteTimeout: 15 * time.Second,
		IdleTimeout: 60 * time.Second,
	}
	errors := make(chan error, 1)
	go func() {
		slog.Info("API listening", "address", cfg.HTTPAddr)
		errors <- server.ListenAndServe()
	}()
	select {
	case err := <-errors:
		if err != http.ErrServerClosed {
			return err
		}
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdown)
	}
	return nil
}
