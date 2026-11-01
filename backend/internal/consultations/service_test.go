package consultations

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestDraftValidationAndFailClosedAccess(t *testing.T) {
	for _, value := range []string{"", " \n\t", string([]byte{0xff}), strings.Repeat("x", 65537)} {
		if validDraft(value) {
			t.Fatalf("invalid draft accepted: %q", value[:min(len(value), 20)])
		}
	}
	if !validDraft("සිංහල draft note") {
		t.Fatal("valid Unicode draft rejected")
	}
	for _, value := range []string{"", " \n\t", string([]byte{0xff}), strings.Repeat("x", 2049)} {
		if validReason(value) {
			t.Fatalf("invalid addendum reason accepted: %q", value[:min(len(value), 20)])
		}
	}
	if !validReason("පැහැදිලි කිරීම") {
		t.Fatal("valid Unicode reason rejected")
	}
	service := NewService(nil, nil)
	_, err := service.Create(context.Background(), "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "Synthetic note")
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("missing access policy must deny: %v", err)
	}
	_, err = service.Sign(context.Background(), "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003", 1)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("missing access policy must deny signing: %v", err)
	}
}
