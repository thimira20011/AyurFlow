package patients

import (
	"errors"
	"testing"
)

func TestProvisionalIdentityEquivalence(t *testing.T) {
	a, err := CanonicalIdentity(" 1999 12345678 V ")
	if err != nil {
		t.Fatal(err)
	}
	b, err := CanonicalIdentity("1999-12345678v")
	if err != nil || a != "199912345678V" || a != b {
		t.Fatalf("equivalence: %q, %q, %v", a, b, err)
	}
	if _, err := CanonicalIdentity(" -  - "); !errors.Is(err, ErrInvalidPatient) {
		t.Fatalf("empty canonical identity: %v", err)
	}
}

func TestRegistrationAllowsOptionalIdentityAndUnicodeName(t *testing.T) {
	if err := ValidateRegistration(RegistrationInput{DisplayName: "සිංහල රෝගියා"}); err != nil {
		t.Fatal(err)
	}
	if err := ValidateRegistration(RegistrationInput{DisplayName: "   "}); !errors.Is(err, ErrInvalidPatient) {
		t.Fatalf("blank name: %v", err)
	}
	if err := ValidateRegistration(RegistrationInput{
		DisplayName: "Synthetic Patient", Identity: &IdentityInput{Type: "NIC", Value: " - "},
	}); !errors.Is(err, ErrInvalidPatient) {
		t.Fatalf("blank supplied identity: %v", err)
	}
}
