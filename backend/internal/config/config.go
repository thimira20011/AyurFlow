package config

import (
	"errors"
	"os"
)

type Config struct {
	Environment string
	HTTPAddr    string
	DatabaseURL string
}

func Load() (Config, error) {
	cfg := Config{
		Environment: valueOrDefault("APP_ENV", "development"),
		HTTPAddr:    valueOrDefault("HTTP_ADDR", "127.0.0.1:8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	return cfg, nil
}

func valueOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
