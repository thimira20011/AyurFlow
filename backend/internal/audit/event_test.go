package audit

import (
	"errors"
	"strings"
	"testing"
)

const syntheticActor = "e9dbd57d-5615-4fbe-8ce4-67ca5481a428"

func validEvent() Event {
	return Event{
		ActorID:       syntheticActor,
		Action:        "patient.updated",
		Object:        Object{Type: "patient", ID: "130d428f-935b-4e53-9142-4728f43846a6"},
		ReasonCode:    "demographic_correction",
		ChangedFields: []string{"phone"},
	}
}

func TestEventRejectsUnstructuredMetadata(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name   string
		change func(*Event)
	}{
		{name: "missing actor", change: func(e *Event) { e.ActorID = "" }},
		{name: "invalid actor", change: func(e *Event) { e.ActorID = "someone" }},
		{name: "zero actor", change: func(e *Event) { e.ActorID = "00000000-0000-0000-0000-000000000000" }},
		{name: "free text action", change: func(e *Event) { e.Action = "patient details changed" }},
		{name: "long action", change: func(e *Event) { e.Action = "patient." + strings.Repeat("a", 96) }},
		{name: "free text object", change: func(e *Event) { e.Object.Type = "clinical note" }},
		{name: "free text identifier", change: func(e *Event) { e.Object.ID = "Synthetic Patient" }},
		{name: "free text reason", change: func(e *Event) { e.ReasonCode = "Clinical note content" }},
		{name: "free text field", change: func(e *Event) { e.ChangedFields = []string{"patient name"} }},
		{name: "duplicate field", change: func(e *Event) { e.ChangedFields = []string{"phone", "phone"} }},
		{name: "too many fields", change: func(e *Event) { e.ChangedFields = make([]string, 33) }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			event := validEvent()
			tc.change(&event)
			if !errors.Is(event.validate(), ErrInvalidEvent) {
				t.Fatal("unstructured audit metadata was accepted")
			}
		})
	}
	if err := validEvent().validate(); err != nil {
		t.Fatalf("valid event rejected: %v", err)
	}
}
