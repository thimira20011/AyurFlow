package patients

import (
	"errors"
	"strings"
	"unicode/utf8"
)

// These checks implement the provisional synthetic-development rule in DEC02.
// HTTP registration uses the shared AUTH-03 session, CSRF and role/record policy.
var ErrInvalidPatient = errors.New("patients: invalid patient fields")

type IdentityInput struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type RegistrationInput struct {
	DisplayName string         `json:"displayName"`
	Phone       *string        `json:"phone,omitempty"`
	Identity    *IdentityInput `json:"identity,omitempty"`
}

// ValidateRegistration validates the smallest provisional patient record.
// Clinical review may add fields or revise identity equivalence before AT02.
func ValidateRegistration(input RegistrationInput) error {
	if !validName(input.DisplayName) {
		return ErrInvalidPatient
	}
	if input.Phone != nil && !validPhone(*input.Phone) {
		return ErrInvalidPatient
	}
	if input.Identity != nil {
		if !validIdentity(*input.Identity) {
			return ErrInvalidPatient
		}
	}
	return nil
}

// The limits are provisional transport safety bounds, not DEC02 clinic rules.
func validName(value string) bool {
	return utf8.ValidString(value) && len(value) <= 512 && strings.TrimSpace(value) != ""
}

func validPhone(value string) bool {
	return utf8.ValidString(value) && len(value) <= 64 && strings.TrimSpace(value) != ""
}

func validIdentity(value IdentityInput) bool {
	if (value.Type != "NIC" && value.Type != "PASSPORT") || len(value.Value) > 128 {
		return false
	}
	_, err := CanonicalIdentity(value.Value)
	return err == nil
}

// CanonicalIdentity matches patient_identities.canonical_value in migration 000005.
// It trims outer ASCII whitespace, removes ASCII spaces/hyphens and uppercases
// ASCII letters. Other characters remain distinct pending clinic review.
func CanonicalIdentity(value string) (string, error) {
	if !utf8.ValidString(value) {
		return "", ErrInvalidPatient
	}
	value = strings.Trim(value, " \t\n\r")
	value = strings.ReplaceAll(strings.ReplaceAll(value, " ", ""), "-", "")
	var b strings.Builder
	b.Grow(len(value))
	for i := 0; i < len(value); i++ {
		c := value[i]
		if c >= 'a' && c <= 'z' {
			c -= 'a' - 'A'
		}
		b.WriteByte(c)
	}
	if b.Len() == 0 {
		return "", ErrInvalidPatient
	}
	return b.String(), nil
}
