package administration

import (
	"errors"
	"strings"
	"testing"
)

func TestRoleInputValidation(t *testing.T) {
	for _, tc := range []struct {
		name  string
		roles []string
		valid bool
	}{
		{name: "empty"}, {name: "duplicates", roles: []string{"billing", "billing"}},
		{name: "too many", roles: make([]string, 33)},
		{name: "explicit sorted copy", roles: []string{"receptionist", "billing"}, valid: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			roles, err := checkedRoles(tc.roles)
			if (err == nil) != tc.valid {
				t.Fatalf("unexpected validation: %v", err)
			}
			if tc.valid {
				roles[0] = "changed"
				if tc.roles[0] != "receptionist" {
					t.Fatal("input roles were mutated")
				}
			}
		})
	}
}

func TestCreateRejectsWeakAndOversizedPasswordsBeforeDatabase(t *testing.T) {
	service := NewService(nil)
	for _, tc := range []struct{ name, password string }{
		{name: "too short", password: "short"},
		{name: "too many bytes", password: strings.Repeat("a", 1025)},
		{name: "invalid utf8", password: strings.Repeat("a", 15) + "\xff"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := service.Create(t.Context(), "invalid", CreateInput{LoginIdentifier: "synthetic", Password: tc.password, Roles: []string{"billing"}})
			if !errors.Is(err, ErrInvalid) {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}
