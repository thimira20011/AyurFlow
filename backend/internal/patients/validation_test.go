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
	birthDate, gender, phone := "1990-04-12", "UNDISCLOSED", "+94770000101"
	input := RegistrationInput{DisplayName: "සිංහල රෝගියා", BirthDate: &birthDate, Gender: &gender, Phone: &phone}
	if err := ValidateRegistration(input); err != nil {
		t.Fatal(err)
	}
	input.DisplayName = "   "
	if err := ValidateRegistration(input); !errors.Is(err, ErrInvalidPatient) {
		t.Fatalf("blank name: %v", err)
	}
	input.DisplayName = "Synthetic Patient"
	input.Identity = &IdentityInput{Type: "NIC", Value: " - "}
	if err := ValidateRegistration(input); !errors.Is(err, ErrInvalidPatient) {
		t.Fatalf("blank supplied identity: %v", err)
	}
	input.Identity = nil
	input.BirthDate = nil
	if err := ValidateRegistration(input); !errors.Is(err, ErrInvalidPatient) {
		t.Fatalf("missing DOB: %v", err)
	}
	input.BirthDate = &birthDate
	phone = "not-a-phone"
	if err := ValidateRegistration(input); !errors.Is(err, ErrInvalidPatient) {
		t.Fatalf("invalid phone: %v", err)
	}
}

func TestNormalizePhone(t *testing.T) {
	for _, input := range []string{"0770000101", "94770000101", "+94 77-0000101"} {
		got, err := NormalizePhone(input)
		if err != nil || got != "+94770000101" {
			t.Fatalf("normalization %q = %q, %v", input, got, err)
		}
	}
	if _, err := NormalizePhone("071234"); !errors.Is(err, ErrInvalidPatient) {
		t.Fatalf("short phone accepted: %v", err)
	}
}
