package inventory_test

import (
	"errors"
	"testing"
	"time"

	"ayurflow/backend/internal/inventory"
)

func TestParseGramsToMilligrams(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		allowZero bool
		wantMg    int64
		wantErr   bool
	}{
		{name: "whole number", input: "1000", wantMg: 1_000_000},
		{name: "three decimals", input: "1000.000", wantMg: 1_000_000},
		{name: "one decimal", input: "37.5", wantMg: 37_500},
		{name: "two decimals", input: "12.34", wantMg: 12_340},
		{name: "one milligram", input: "0.001", wantMg: 1},
		{name: "max supported range", input: "999999999.999", wantMg: 999_999_999_999},
		{name: "zero disallowed", input: "0.000", allowZero: false, wantErr: true},
		{name: "zero allowed", input: "0.000", allowZero: true, wantMg: 0},
		{name: "negative rejected", input: "-5.000", allowZero: true, wantErr: true},
		{name: "four decimals rejected", input: "10.0001", wantErr: true},
		{name: "overflow rejected", input: "1000000000.000", wantErr: true},
		{name: "empty rejected", input: "   ", wantErr: true},
		{name: "non-numeric rejected", input: "50g", wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := inventory.ParseGramsToMilligrams(tc.input, tc.allowZero)
			if tc.wantErr {
				if !errors.Is(err, inventory.ErrValidation) {
					t.Fatalf("ParseGramsToMilligrams(%q) error = %v, want ErrValidation", tc.input, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParseGramsToMilligrams(%q) unexpected error: %v", tc.input, err)
			}
			if got != tc.wantMg {
				t.Fatalf("ParseGramsToMilligrams(%q) = %d, want %d", tc.input, got, tc.wantMg)
			}
		})
	}
}

func TestFormatMilligramsToGrams(t *testing.T) {
	if got := inventory.FormatMilligramsToGrams(1_000_000); got != "1000.000" {
		t.Fatalf("FormatMilligramsToGrams(1000000) = %q, want %q", got, "1000.000")
	}
	if got := inventory.FormatMilligramsToGrams(3_333); got != "3.333" {
		t.Fatalf("FormatMilligramsToGrams(3333) = %q, want %q", got, "3.333")
	}
	if got := inventory.FormatMilligramsToGrams(1); got != "0.001" {
		t.Fatalf("FormatMilligramsToGrams(1) = %q, want %q", got, "0.001")
	}
	if got := inventory.FormatMilligramsToGrams(0); got != "0.000" {
		t.Fatalf("FormatMilligramsToGrams(0) = %q, want %q", got, "0.000")
	}
}

func TestEvaluateEligibility(t *testing.T) {
	colomboToday := "2026-10-31"
	future := "2027-06-30"
	sameDay := "2026-10-31"
	yesterday := "2026-10-30"

	if got := inventory.EvaluateEligibility(false, 500_000, &future, colomboToday); got != inventory.EligibilityEligible {
		t.Fatalf("future unblocked batch = %q, want %q", got, inventory.EligibilityEligible)
	}
	if got := inventory.EvaluateEligibility(false, 500_000, &sameDay, colomboToday); got != inventory.EligibilityEligible {
		t.Fatalf("same-day expiry in Asia/Colombo = %q, want %q (inclusive on expires_at)", got, inventory.EligibilityEligible)
	}
	if got := inventory.EvaluateEligibility(false, 250_000, &yesterday, colomboToday); got != inventory.EligibilityExpired {
		t.Fatalf("past expiry in Asia/Colombo = %q, want %q", got, inventory.EligibilityExpired)
	}
	if got := inventory.EvaluateEligibility(false, 200_000, nil, colomboToday); got != inventory.EligibilityUnknownExpiry {
		t.Fatalf("nil expiry batch = %q, want %q (SRS §8 gate rule)", got, inventory.EligibilityUnknownExpiry)
	}
	if got := inventory.EvaluateEligibility(true, 500_000, &future, colomboToday); got != inventory.EligibilityBlocked {
		t.Fatalf("blocked batch = %q, want %q", got, inventory.EligibilityBlocked)
	}
	if got := inventory.EvaluateEligibility(false, 0, &future, colomboToday); got != inventory.EligibilityDepleted {
		t.Fatalf("zero remaining batch = %q, want %q", got, inventory.EligibilityDepleted)
	}
}

func TestColomboDateStringBoundary(t *testing.T) {
	// 2026-10-30T19:00:00Z is 2026-10-31T00:30:00+05:30 in Asia/Colombo.
	utcInstant := time.Date(2026, 10, 30, 19, 0, 0, 0, time.UTC)
	if got := inventory.ColomboDateString(utcInstant); got != "2026-10-31" {
		t.Fatalf("ColomboDateString(%v) = %q, want %q", utcInstant, got, "2026-10-31")
	}
}
