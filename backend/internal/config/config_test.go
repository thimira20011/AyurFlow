package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestLoadDatabaseURL(t *testing.T) {
	for _, tc := range []struct {
		name, direct, contents string
		missing, wantError     bool
	}{
		{name: "environment", direct: "synthetic-dsn"},
		{name: "file with newline", contents: "synthetic-dsn\n"},
		{name: "ambiguous", direct: "synthetic-dsn", contents: "other", wantError: true},
		{name: "empty file", contents: "\n", wantError: true},
		{name: "missing file", missing: true, wantError: true},
		{name: "oversized file", contents: strings.Repeat("x", 65537), wantError: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("DATABASE_URL", tc.direct)
			t.Setenv("DATABASE_URL_FILE", "")
			if tc.contents != "" || tc.missing {
				path := filepath.Join(t.TempDir(), "database-url")
				if !tc.missing {
					if err := os.WriteFile(path, []byte(tc.contents), 0600); err != nil {
						t.Fatal(err)
					}
				}
				t.Setenv("DATABASE_URL_FILE", path)
			}
			value, err := loadDatabaseURL()
			if (err != nil) != tc.wantError {
				t.Fatalf("error=%v, wantError=%v", err, tc.wantError)
			}
			if err == nil && value != "synthetic-dsn" {
				t.Fatal("database secret was not loaded correctly")
			}
		})
	}
}

func TestLoadAuthPolicy(t *testing.T) {
	tests := []struct {
		name        string
		values      map[string]string
		wantEnabled bool
		wantError   bool
	}{
		{name: "disabled when unset", values: map[string]string{}},
		{name: "enabled with explicit values", values: map[string]string{
			"AUTH_ENABLED": "true", "AUTH_IDLE_TIMEOUT": "30m", "AUTH_ABSOLUTE_TIMEOUT": "8h",
			"AUTH_ATTEMPT_LIMIT": "5", "AUTH_ATTEMPT_WINDOW": "15m",
			"AUTH_BLOCK_DURATION": "15m", "AUTH_ALLOWED_ORIGIN": "https://clinic.example",
		}, wantEnabled: true},
		{name: "missing expiry", values: map[string]string{
			"AUTH_ENABLED": "true", "AUTH_ALLOWED_ORIGIN": "https://clinic.example",
		}, wantError: true},
		{name: "idle longer than absolute", values: map[string]string{
			"AUTH_ENABLED": "true", "AUTH_IDLE_TIMEOUT": "9h", "AUTH_ABSOLUTE_TIMEOUT": "8h",
			"AUTH_ATTEMPT_LIMIT": "5", "AUTH_ATTEMPT_WINDOW": "15m",
			"AUTH_BLOCK_DURATION": "15m", "AUTH_ALLOWED_ORIGIN": "https://clinic.example",
		}, wantError: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			policy, err := loadAuthPolicy(func(key string) string { return tc.values[key] })
			if (err != nil) != tc.wantError {
				t.Fatalf("error = %v, wantError %v", err, tc.wantError)
			}
			if policy.Enabled != tc.wantEnabled {
				t.Fatalf("enabled = %v, want %v", policy.Enabled, tc.wantEnabled)
			}
			if tc.wantEnabled && policy.IdleTimeout != 30*time.Minute {
				t.Fatalf("idle timeout = %v", policy.IdleTimeout)
			}
		})
	}
}
