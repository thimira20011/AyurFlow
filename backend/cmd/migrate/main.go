package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"ayurflow/backend/db"
	"ayurflow/backend/internal/config"
	"ayurflow/backend/internal/platform/database"
)

func main() {
	if err := run(); err != nil {
		slog.Error("Migration failed; check configuration, connectivity and migration SQL")
		os.Exit(1)
	}
	slog.Info("Migrations applied")
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	pool, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	return db.Migrate(ctx, pool)
}
