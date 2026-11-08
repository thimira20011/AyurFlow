// Package inventory implements botanical items, stock batches, blocking,
// and expiry eligibility for AyurFlow (TASK-INV-01, SRS INV-01–04, ADM-01, AUD-01–02).
//
// All quantities are represented in fixed-precision grams with 3 decimal places
// (0.001 g = 1 mg), computed in Go as int64 milligrams, stored in PostgreSQL
// as NUMERIC(12, 3), and serialized in JSON as canonical 3-decimal strings.
// Binary floating-point is never used for stock quantities.
package inventory

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

// Domain errors mapped by the HTTP transport layer.
var (
	ErrForbidden  = errors.New("inventory: forbidden")
	ErrNotFound   = errors.New("inventory: not found")
	ErrConflict   = errors.New("inventory: conflict")
	ErrValidation = errors.New("inventory: validation failed")
)

const (
	// MaxMilligrams is the maximum representable quantity in NUMERIC(12, 3):
	// 999,999,999.999 g = 999,999,999,999 mg.
	MaxMilligrams int64 = 999_999_999_999
)

var (
	gramsPattern     = regexp.MustCompile(`^\d{1,9}(\.\d{1,3})?$`)
	itemCodePattern  = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$`)
	batchRefPattern  = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._/-]{1,127}$`)
	isoDatePattern   = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	colomboZoneFixed = time.FixedZone("Asia/Colombo", 5*3600+30*60)
)

// EligibilityStatus classifies whether a stock batch may be selected for consumption.
type EligibilityStatus string

const (
	EligibilityEligible      EligibilityStatus = "eligible"
	EligibilityBlocked       EligibilityStatus = "blocked"
	EligibilityExpired       EligibilityStatus = "expired"
	EligibilityUnknownExpiry EligibilityStatus = "unknown_expiry"
	EligibilityDepleted      EligibilityStatus = "depleted"
)

// BotanicalItem represents a botanical catalog entry (SRS INV-01, ADM-01).
type BotanicalItem struct {
	ID                string     `json:"id"`
	Code              string     `json:"code"`
	DisplayName       string     `json:"displayName"`
	BaseUnit          string     `json:"baseUnit"`
	Active            bool       `json:"active"`
	DeactivatedReason *string    `json:"deactivatedReason,omitempty"`
	DeactivatedBy     *string    `json:"deactivatedBy,omitempty"`
	DeactivatedAt     *time.Time `json:"deactivatedAt,omitempty"`
	CreatedBy         string     `json:"createdBy"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}

// BotanicalItemPage is a bounded paginated list of botanical items.
type BotanicalItemPage struct {
	Items      []BotanicalItem `json:"items"`
	NextCursor *string         `json:"nextCursor"`
}

// StockBatch represents a received botanical batch with real-time eligibility (SRS INV-01–04).
type StockBatch struct {
	ID              string            `json:"id"`
	ItemID          string            `json:"itemId"`
	ItemCode        string            `json:"itemCode"`
	ItemDisplayName string            `json:"itemDisplayName"`
	BatchReference  string            `json:"batchReference"`
	ReceivedGrams   string            `json:"receivedGrams"`
	RemainingGrams  string            `json:"remainingGrams"`
	ExpiresAt       *string           `json:"expiresAt"`
	Blocked         bool              `json:"blocked"`
	BlockReason     *string           `json:"blockReason"`
	BlockedBy       *string           `json:"blockedBy,omitempty"`
	BlockedAt       *time.Time        `json:"blockedAt,omitempty"`
	Eligibility     EligibilityStatus `json:"eligibility"`
	ReceivedBy      string            `json:"receivedBy"`
	ReceivedAt      time.Time         `json:"receivedAt"`
}

// BatchSummaryTotals reports stock totals grouped by eligibility state in fixed-precision grams.
type BatchSummaryTotals struct {
	EligibleGrams      string `json:"eligibleGrams"`
	BlockedGrams       string `json:"blockedGrams"`
	ExpiredGrams       string `json:"expiredGrams"`
	UnknownExpiryGrams string `json:"unknownExpiryGrams"`
}

// StockBatchPage is a bounded paginated list of stock batches with summary totals.
type StockBatchPage struct {
	Items      []StockBatch       `json:"items"`
	Summary    BatchSummaryTotals `json:"summary"`
	ClinicDate string             `json:"clinicDate"`
	NextCursor *string            `json:"nextCursor"`
}

// CreateItemRequest is the payload for POST /api/v1/inventory/items.
type CreateItemRequest struct {
	Code        string `json:"code"`
	DisplayName string `json:"displayName"`
}

// DeactivateItemRequest is the payload for POST /api/v1/inventory/items/:itemId/deactivate.
type DeactivateItemRequest struct {
	Reason string `json:"reason"`
}

// ReceiveBatchRequest is the payload for POST /api/v1/inventory/batches.
type ReceiveBatchRequest struct {
	ItemID         string  `json:"itemId"`
	BatchReference string  `json:"batchReference"`
	ReceivedGrams  string  `json:"receivedGrams"`
	ExpiresAt      *string `json:"expiresAt"`
}

// BlockBatchRequest is the payload for POST /api/v1/inventory/batches/:batchId/block.
type BlockBatchRequest struct {
	Reason string `json:"reason"`
}

// ListBatchesFilter controls filtering and pagination for GET /api/v1/inventory/batches.
type ListBatchesFilter struct {
	ItemID       string
	EligibleOnly bool
	Limit        int
	Cursor       string
}

// ParseGramsToMilligrams parses a fixed-precision decimal gram string (up to 3 decimal places)
// into exact integer milligrams. It rejects zero/negative quantities unless allowZero is true,
// and never uses floating-point parsing.
func ParseGramsToMilligrams(raw string, allowZero bool) (int64, error) {
	trimmed := strings.TrimSpace(raw)
	if !gramsPattern.MatchString(trimmed) {
		return 0, fmt.Errorf("%w: quantity must be a positive decimal in grams with at most 3 decimal places", ErrValidation)
	}
	parts := strings.SplitN(trimmed, ".", 2)
	whole, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: invalid gram quantity", ErrValidation)
	}
	var frac int64
	if len(parts) == 2 {
		padded := (parts[1] + "000")[:3]
		frac, err = strconv.ParseInt(padded, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("%w: invalid fractional gram quantity", ErrValidation)
		}
	}
	mg := whole*1000 + frac
	if mg > MaxMilligrams {
		return 0, fmt.Errorf("%w: quantity exceeds maximum supported stock range (999999999.999 g)", ErrValidation)
	}
	if !allowZero && mg <= 0 {
		return 0, fmt.Errorf("%w: quantity in grams must be greater than 0.000", ErrValidation)
	}
	if allowZero && mg < 0 {
		return 0, fmt.Errorf("%w: quantity in grams cannot be negative", ErrValidation)
	}
	return mg, nil
}

// FormatMilligramsToGrams formats integer milligrams into a canonical 3-decimal gram string (e.g., "1000.000").
func FormatMilligramsToGrams(mg int64) string {
	sign := ""
	abs := mg
	if abs < 0 {
		sign = "-"
		abs = -abs
	}
	whole := abs / 1000
	frac := abs % 1000
	return fmt.Sprintf("%s%d.%03d", sign, whole, frac)
}

// ColomboDateString returns the YYYY-MM-DD date in Asia/Colombo for the given instant.
func ColomboDateString(instant time.Time) string {
	loc, err := time.LoadLocation("Asia/Colombo")
	if err != nil {
		loc = colomboZoneFixed
	}
	return instant.In(loc).Format("2006-01-02")
}

// ValidateISODate verifies that a string is a valid calendar date in YYYY-MM-DD format.
func ValidateISODate(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if !isoDatePattern.MatchString(trimmed) {
		return "", fmt.Errorf("%w: expiresAt must be in YYYY-MM-DD format", ErrValidation)
	}
	parsed, err := time.Parse("2006-01-02", trimmed)
	if err != nil || parsed.Format("2006-01-02") != trimmed {
		return "", fmt.Errorf("%w: expiresAt must be a valid calendar date in YYYY-MM-DD format", ErrValidation)
	}
	return trimmed, nil
}

// EvaluateEligibility determines whether a batch is eligible for consumption on the given
// Asia/Colombo clinic date (YYYY-MM-DD) under SRS INV-02, INV-03, and §8 gate rules:
//   - Blocked batches are always "blocked".
//   - Batches with no expiry date (expiresAt == nil) are "unknown_expiry" (not consumable).
//   - Batches where colomboDate > *expiresAt are "expired" (inclusive on expires_at).
//   - Batches with remainingMg <= 0 are "depleted".
//   - All other batches are "eligible".
func EvaluateEligibility(blocked bool, remainingMg int64, expiresAt *string, colomboDate string) EligibilityStatus {
	if blocked {
		return EligibilityBlocked
	}
	if expiresAt == nil || strings.TrimSpace(*expiresAt) == "" {
		return EligibilityUnknownExpiry
	}
	if colomboDate > *expiresAt {
		return EligibilityExpired
	}
	if remainingMg <= 0 {
		return EligibilityDepleted
	}
	return EligibilityEligible
}

func validateItemCode(raw string) (string, error) {
	code := strings.ToUpper(strings.TrimSpace(raw))
	if !itemCodePattern.MatchString(code) {
		return "", fmt.Errorf("%w: code must be 2–64 characters (letters, digits, '.', '_', '-')", ErrValidation)
	}
	return code, nil
}

func validateDisplayName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	if !utf8.ValidString(name) {
		return "", fmt.Errorf("%w: displayName must be valid UTF-8", ErrValidation)
	}
	runes := utf8.RuneCountInString(name)
	if runes == 0 || runes > 200 {
		return "", fmt.Errorf("%w: displayName is required and must be at most 200 characters", ErrValidation)
	}
	return name, nil
}

func validateBatchReference(raw string) (string, error) {
	ref := strings.TrimSpace(raw)
	if !batchRefPattern.MatchString(ref) {
		return "", fmt.Errorf("%w: batchReference must be 2–128 characters (letters, digits, '.', '_', '/', '-')", ErrValidation)
	}
	return ref, nil
}

func validateReason(raw, fieldName string) (string, error) {
	reason := strings.TrimSpace(raw)
	if !utf8.ValidString(reason) {
		return "", fmt.Errorf("%w: %s must be valid UTF-8", ErrValidation, fieldName)
	}
	runes := utf8.RuneCountInString(reason)
	if runes == 0 || runes > 500 {
		return "", fmt.Errorf("%w: %s is required and must be at most 500 characters", ErrValidation, fieldName)
	}
	return reason, nil
}
