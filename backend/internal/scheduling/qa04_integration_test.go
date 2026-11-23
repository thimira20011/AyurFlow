//go:build integration

package scheduling

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"ayurflow/backend/internal/testutil"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestQA04SessionObservationAccess(t *testing.T) {
	pool := testutil.Postgres(t)
	service := NewService(pool)
	reception := seedStaff(t, pool, "qa04-reception", "receptionist")
	clinician := seedStaff(t, pool, "qa04-clinician", "clinician")
	therapist := seedStaff(t, pool, "qa04-therapist", "therapist")
	patient, plan, stage := syntheticPlan(t, pool, reception, clinician, service)
	room, err := service.CreateRoom(t.Context(), reception, "QA04", "Synthetic privacy room")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now().UTC().Add(time.Hour).Truncate(time.Minute)
	end := start.Add(time.Hour)
	for _, resource := range []struct{ room, therapist *string }{{&room.ID, nil}, {nil, &therapist}} {
		if _, err := service.AddAvailability(t.Context(), reception, resource.room, resource.therapist, start, end); err != nil {
			t.Fatal(err)
		}
	}
	session, err := service.Book(t.Context(), reception, BookRequest{PatientID: patient, PlanID: plan, StageID: stage, RoomID: room.ID, TherapistID: therapist, StartsAt: start, EndsAt: end})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Start(t.Context(), therapist, session.ID); err != nil {
		t.Fatal(err)
	}
	const observation = "Synthetic private delivery observation QA04"
	if _, err := service.Complete(t.Context(), therapist, session.ID, observation); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, actor string
		count       int
		clinical    bool
	}{
		{"reception", reception, 1, false},
		{"assigned clinician", clinician, 1, true},
		{"assigned therapist", therapist, 1, true},
		{"unassigned clinician", seedStaff(t, pool, "qa04-other-clinician", "clinician"), 0, false},
		{"unassigned therapist", seedStaff(t, pool, "qa04-other-therapist", "therapist"), 0, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			items, err := service.ListSessions(t.Context(), tc.actor, start, end)
			if err != nil || len(items) != tc.count {
				t.Fatalf("session visibility count=%d err=%v", len(items), err)
			}
			body, err := json.Marshal(items)
			if err != nil {
				t.Fatal(err)
			}
			if strings.Contains(string(body), observation) != tc.clinical {
				t.Fatal("observation visibility does not match record permission")
			}
		})
	}
	for _, role := range []string{"administrator", "dispensary", "billing", "report_reader"} {
		actor := seedStaff(t, pool, "qa04-"+role, role)
		if _, err := service.ListSessions(t.Context(), actor, start, end); !errors.Is(err, ErrForbidden) {
			t.Fatalf("role %s list error=%v", role, err)
		}
	}
	var saved string
	if err := pool.QueryRow(t.Context(), `SELECT observations FROM therapy_sessions WHERE id=$1`, session.ID).Scan(&saved); err != nil || saved != observation {
		t.Fatal("privacy projection changed committed clinical history")
	}
	if _, err := pool.Exec(t.Context(), `UPDATE staff_accounts SET active=false WHERE id=$1`, therapist); err != nil {
		t.Fatal(err)
	}
	if _, err := service.ListSessions(t.Context(), therapist, start, end); !errors.Is(err, ErrForbidden) {
		t.Fatal("disabled therapist retained access")
	}
}

func TestQA04SchedulingAuditFailureRollsBack(t *testing.T) {
	pool := testutil.Postgres(t)
	service := NewService(pool)
	reception := seedStaff(t, pool, "qa04-audit-reception", "receptionist")
	clinician := seedStaff(t, pool, "qa04-audit-clinician", "clinician")
	therapist := seedStaff(t, pool, "qa04-audit-therapist", "therapist")
	patient, plan, stage := syntheticPlan(t, pool, reception, clinician, service)
	room, err := service.CreateRoom(t.Context(), reception, "QA04-AUDIT", "Synthetic audit room")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now().UTC().Add(time.Hour).Truncate(time.Minute)
	end := start.Add(time.Hour)
	availability, err := service.AddAvailability(t.Context(), reception, &room.ID, nil, start, end.Add(2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.AddAvailability(t.Context(), reception, nil, &therapist, start, end.Add(2*time.Hour)); err != nil {
		t.Fatal(err)
	}
	request := BookRequest{PatientID: patient, PlanID: plan, StageID: stage, RoomID: room.ID, TherapistID: therapist, StartsAt: start, EndsAt: end}
	booked, err := service.Book(t.Context(), reception, request)
	if err != nil {
		t.Fatal(err)
	}
	request.StartsAt, request.EndsAt = end, end.Add(time.Hour)
	active, err := service.Book(t.Context(), reception, request)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Start(t.Context(), therapist, active.ID); err != nil {
		t.Fatal(err)
	}
	snapshot := func() string {
		t.Helper()
		var value string
		if err := pool.QueryRow(t.Context(), `SELECT json_build_array(
			(SELECT json_agg(x ORDER BY id) FROM clinic_rooms x),
			(SELECT json_agg(x ORDER BY id) FROM resource_availability x),
			(SELECT json_agg(x ORDER BY id) FROM therapy_sessions x),
			(SELECT json_agg(x ORDER BY id) FROM audit_events x))::text`).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	before := snapshot()
	if _, err := pool.Exec(t.Context(), `CREATE FUNCTION qa04_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN RAISE EXCEPTION 'synthetic forced audit failure'; END; $$;
		CREATE TRIGGER qa04_reject BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION qa04_reject_audit()`); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		mutate func() error
	}{
		{"room", func() error {
			_, err := service.CreateRoom(t.Context(), reception, "QA04-FAIL", "Synthetic failed room")
			return err
		}},
		{"availability", func() error {
			_, err := service.ChangeAvailability(t.Context(), reception, availability.ID, start.Add(-time.Hour), end.Add(2*time.Hour))
			return err
		}},
		{"booking", func() error {
			request.StartsAt, request.EndsAt = end.Add(time.Hour), end.Add(2*time.Hour)
			_, err := service.Book(t.Context(), reception, request)
			return err
		}},
		{"reschedule", func() error {
			_, err := service.Reschedule(t.Context(), reception, booked.ID, RescheduleRequest{RoomID: room.ID, TherapistID: therapist, StartsAt: end.Add(time.Hour), EndsAt: end.Add(2 * time.Hour), Version: booked.Version})
			return err
		}},
		{"start", func() error { _, err := service.Start(t.Context(), therapist, booked.ID); return err }},
		{"complete", func() error {
			_, err := service.Complete(t.Context(), therapist, active.ID, "Synthetic failed observation")
			return err
		}},
		{"cancel", func() error {
			_, err := service.Cancel(t.Context(), reception, booked.ID, "Synthetic failed cancellation")
			return err
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var failure *pgconn.PgError
			if err := tc.mutate(); !errors.As(err, &failure) || failure.Code != "P0001" {
				t.Fatalf("mutation did not reach the failing audit trigger: %v", err)
			}
			if after := snapshot(); after != before {
				t.Fatal("failed audit changed committed business or audit history")
			}
		})
	}
}
