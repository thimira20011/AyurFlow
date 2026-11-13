//go:build integration

package scheduling

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"ayurflow/backend/internal/clinical"
	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5/pgxpool"
)

func seedStaff(t *testing.T, pool *pgxpool.Pool, login, role string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(t.Context(), `INSERT INTO staff_accounts(login_identifier,password_hash)
		VALUES ($1,'$argon2id$synthetic-test-only') RETURNING id::text`, login).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(), `INSERT INTO staff_roles(staff_id,role_code) VALUES ($1,$2)`, id, role); err != nil {
		t.Fatal(err)
	}
	return id
}

func syntheticPlan(t *testing.T, pool *pgxpool.Pool, receptionist, clinician string, service *Service) (string, string, string) {
	t.Helper()
	var patient string
	if err := pool.QueryRow(t.Context(), `INSERT INTO patients(display_name,created_by,updated_by)
		VALUES ('Synthetic scheduling patient',$1,$1) RETURNING id::text`, receptionist).Scan(&patient); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(), `INSERT INTO patient_clinician_assignments(patient_id,clinician_id,granted_by)
		VALUES ($1,$2,$3)`, patient, clinician, receptionist); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(), `INSERT INTO consultations(patient_id,status,draft_text,signed_text,signed_by,signed_at,created_by,updated_by)
		VALUES ($1,'signed',NULL,'Synthetic signed consultation',$2,clock_timestamp(),$2,$2)`, patient, clinician); err != nil {
		t.Fatal(err)
	}
	pathway := clinical.MemberBPathway()
	plans := clinical.NewService(pool, pathway, service, service)
	plan, err := plans.Create(t.Context(), clinician, patient, "")
	if err != nil {
		t.Fatal(err)
	}
	plan, err = plans.Start(t.Context(), clinician, plan.ID, plan.Version)
	if err != nil {
		t.Fatal(err)
	}
	var stage string
	if err := pool.QueryRow(t.Context(), `SELECT id::text FROM plan_stages WHERE plan_id=$1 AND ordinal=1`, plan.ID).Scan(&stage); err != nil {
		t.Fatal(err)
	}
	if _, err := plans.Approve(t.Context(), clinician, plan.ID, stage, plan.Version, pathway[0].RequiredChecks); err != nil {
		t.Fatal(err)
	}
	return patient, plan.ID, stage
}

func TestBookingClearanceAndCancellation(t *testing.T) {
	pool := testutil.Postgres(t)
	service := NewService(pool)
	receptionist := seedStaff(t, pool, "synthetic-schedule-reception", "receptionist")
	clinician := seedStaff(t, pool, "synthetic-schedule-clinician", "clinician")
	therapist := seedStaff(t, pool, "synthetic-schedule-therapist", "therapist")
	otherTherapist := seedStaff(t, pool, "synthetic-schedule-other-therapist", "therapist")
	patient, planID, stageID := syntheticPlan(t, pool, receptionist, clinician, service)
	room, err := service.CreateRoom(t.Context(), receptionist, "SYN-01", "Synthetic room")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Minute)
	end := start.Add(time.Hour)
	windowStart, windowEnd := start.Add(-time.Hour), end.Add(4*time.Hour)
	roomWindow, err := service.AddAvailability(t.Context(), receptionist, &room.ID, nil, windowStart, windowEnd)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.AddAvailability(t.Context(), receptionist, nil, &therapist, windowStart, windowEnd); err != nil {
		t.Fatal(err)
	}
	if _, err := service.AddAvailability(t.Context(), receptionist, nil, &otherTherapist, windowStart, windowEnd); err != nil {
		t.Fatal(err)
	}
	request := BookRequest{PatientID: patient, PlanID: planID, StageID: stageID, RoomID: room.ID, TherapistID: therapist, StartsAt: start, EndsAt: end}
	if _, err := service.Book(t.Context(), clinician, request); !errors.Is(err, ErrForbidden) {
		t.Fatalf("clinician booked: %v", err)
	}
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := service.Book(context.Background(), receptionist, request)
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	successes, conflicts := 0, 0
	for err := range results {
		if err == nil {
			successes++
		} else if errors.Is(err, ErrConflict) {
			conflicts++
		} else {
			t.Fatalf("race: %v", err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("overlap race: successes=%d conflicts=%d", successes, conflicts)
	}
	if _, err := service.ChangeAvailability(t.Context(), clinician, roomWindow.ID, windowStart, start.Add(-time.Minute)); !errors.Is(err, ErrForbidden) {
		t.Fatalf("clinician changed availability: %v", err)
	}
	if _, err := service.ChangeAvailability(t.Context(), receptionist, roomWindow.ID, end.Add(time.Minute), windowEnd); !errors.Is(err, ErrConflict) {
		t.Fatalf("booked slot lost coverage: %v", err)
	}
	changedWindow, err := service.ChangeAvailability(t.Context(), receptionist, roomWindow.ID, windowStart.Add(-time.Hour), windowEnd)
	if err != nil || !changedWindow.StartsAt.Equal(windowStart.Add(-time.Hour)) {
		t.Fatalf("safe availability change: %+v %v", changedWindow, err)
	}
	items, err := service.ListSessions(t.Context(), therapist, start.Add(-time.Minute), end.Add(time.Minute))
	if err != nil || len(items) != 1 {
		t.Fatalf("therapist list: %d %v", len(items), err)
	}
	if other, err := service.ListSessions(t.Context(), otherTherapist, start.Add(-time.Minute), end.Add(time.Minute)); err != nil || len(other) != 0 {
		t.Fatalf("unassigned list: %d %v", len(other), err)
	}
	first := items[0]
	if _, err := service.Start(t.Context(), otherTherapist, first.ID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("unassigned start: %v", err)
	}
	rescheduled, err := service.Reschedule(t.Context(), receptionist, first.ID, RescheduleRequest{
		RoomID: room.ID, TherapistID: therapist, StartsAt: start.Add(30 * time.Minute), EndsAt: end.Add(30 * time.Minute), Version: first.Version,
	})
	if err != nil || rescheduled.Version != first.Version+1 {
		t.Fatalf("reschedule: %+v %v", rescheduled, err)
	}
	if _, err := service.Reschedule(t.Context(), receptionist, first.ID, RescheduleRequest{
		RoomID: room.ID, TherapistID: therapist, StartsAt: start, EndsAt: end, Version: first.Version,
	}); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale reschedule: %v", err)
	}
	second, err := service.Book(t.Context(), receptionist, BookRequest{PatientID: patient, PlanID: planID, StageID: stageID,
		RoomID: room.ID, TherapistID: otherTherapist, StartsAt: end.Add(time.Hour), EndsAt: end.Add(2 * time.Hour)})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Reschedule(t.Context(), receptionist, first.ID, RescheduleRequest{
		RoomID: room.ID, TherapistID: therapist, StartsAt: second.StartsAt, EndsAt: second.EndsAt, Version: rescheduled.Version,
	}); !errors.Is(err, ErrConflict) {
		t.Fatalf("overlapping reschedule: %v", err)
	}
	var retainedStart time.Time
	if err := pool.QueryRow(t.Context(), `SELECT starts_at FROM therapy_sessions WHERE id=$1`, first.ID).Scan(&retainedStart); err != nil || !retainedStart.Equal(rescheduled.StartsAt) {
		t.Fatalf("failed reschedule lost original booking: %v %v", retainedStart, err)
	}
	started, err := service.Start(t.Context(), therapist, first.ID)
	if err != nil || started.Status != "in_progress" {
		t.Fatalf("start: %+v %v", started, err)
	}
	plans := clinical.NewService(pool, clinical.MemberBPathway(), service, service)
	var version int64
	if err := pool.QueryRow(t.Context(), `SELECT record_version FROM care_plans WHERE id=$1`, planID).Scan(&version); err != nil {
		t.Fatal(err)
	}
	plan, err := plans.Hold(t.Context(), clinician, planID, version, "Synthetic pause")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Start(t.Context(), otherTherapist, second.ID); !errors.Is(err, ErrConflict) {
		t.Fatalf("started while held: %v", err)
	}
	completed, err := service.Complete(t.Context(), therapist, first.ID, "Synthetic delivery observation")
	if err != nil || completed.Status != "completed" {
		t.Fatalf("completion during hold: %+v %v", completed, err)
	}
	if _, err := plans.Cancel(t.Context(), clinician, planID, plan.Version, "Synthetic cancellation"); err != nil {
		t.Fatal(err)
	}
	var secondStatus string
	if err := pool.QueryRow(t.Context(), `SELECT status FROM therapy_sessions WHERE id=$1`, second.ID).Scan(&secondStatus); err != nil || secondStatus != "cancelled" {
		t.Fatalf("future session: %s %v", secondStatus, err)
	}
	if _, err := service.Complete(t.Context(), therapist, first.ID, "Rewrite"); !errors.Is(err, ErrConflict) {
		t.Fatalf("rewrote completed session: %v", err)
	}
}

func TestPreparatoryStageRequiresDeliveredSession(t *testing.T) {
	pool := testutil.Postgres(t)
	service := NewService(pool)
	receptionist := seedStaff(t, pool, "synthetic-stage-reception", "receptionist")
	clinician := seedStaff(t, pool, "synthetic-stage-clinician", "clinician")
	therapist := seedStaff(t, pool, "synthetic-stage-therapist", "therapist")
	patient, planID, stageID := syntheticPlan(t, pool, receptionist, clinician, service)
	plans := clinical.NewService(pool, clinical.MemberBPathway(), service, service)
	var version int64
	if err := pool.QueryRow(t.Context(), `SELECT record_version FROM care_plans WHERE id=$1`, planID).Scan(&version); err != nil {
		t.Fatal(err)
	}
	if _, err := plans.Advance(t.Context(), clinician, planID, version); !errors.Is(err, clinical.ErrCompletionPending) {
		t.Fatalf("empty preparatory stage advanced: %v", err)
	}
	room, err := service.CreateRoom(t.Context(), receptionist, "SYN-STAGE", "Synthetic stage room")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now().UTC().Add(time.Hour).Truncate(time.Minute)
	end := start.Add(time.Hour)
	for _, resource := range []struct{ room, therapist *string }{{&room.ID, nil}, {nil, &therapist}} {
		if _, err := service.AddAvailability(t.Context(), receptionist, resource.room, resource.therapist, start.Add(-time.Minute), end.Add(time.Minute)); err != nil {
			t.Fatal(err)
		}
	}
	session, err := service.Book(t.Context(), receptionist, BookRequest{PatientID: patient, PlanID: planID, StageID: stageID,
		RoomID: room.ID, TherapistID: therapist, StartsAt: start, EndsAt: end})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := plans.Advance(t.Context(), clinician, planID, version); !errors.Is(err, clinical.ErrCompletionPending) {
		t.Fatalf("booked session permitted advancement: %v", err)
	}
	if _, err := service.Start(t.Context(), therapist, session.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Complete(t.Context(), therapist, session.ID, "Synthetic preparatory delivery"); err != nil {
		t.Fatal(err)
	}
	advanced, err := plans.Advance(t.Context(), clinician, planID, version)
	if err != nil || advanced.CurrentOrdinal != 2 {
		t.Fatalf("completed preparatory stage did not advance: %+v %v", advanced, err)
	}
}
