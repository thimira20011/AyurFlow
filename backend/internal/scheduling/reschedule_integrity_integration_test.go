//go:build integration

package scheduling

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"ayurflow/backend/internal/testutil"
	"github.com/jackc/pgx/v5/pgxpool"
)

type rescheduleFixture struct {
	pool       *pgxpool.Pool
	service    *Service
	reception  string
	rooms      [2]Room
	therapists [2]string
	session    Session
}

func newRescheduleFixture(t *testing.T) rescheduleFixture {
	t.Helper()
	f := rescheduleFixture{pool: testutil.Postgres(t)}
	f.service = NewService(f.pool)
	f.reception = seedStaff(t, f.pool, "reschedule-reception", "receptionist")
	clinician := seedStaff(t, f.pool, "reschedule-clinician", "clinician")
	f.therapists = [2]string{seedStaff(t, f.pool, "reschedule-therapist-a", "therapist"), seedStaff(t, f.pool, "reschedule-therapist-b", "therapist")}
	start := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Minute)
	for i, code := range []string{"RESCHEDULE-A", "RESCHEDULE-B"} {
		var err error
		f.rooms[i], err = f.service.CreateRoom(t.Context(), f.reception, code, "Synthetic reschedule room")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := f.service.AddAvailability(t.Context(), f.reception, &f.rooms[i].ID, nil, start, start.Add(8*time.Hour)); err != nil {
			t.Fatal(err)
		}
		if _, err := f.service.AddAvailability(t.Context(), f.reception, nil, &f.therapists[i], start, start.Add(8*time.Hour)); err != nil {
			t.Fatal(err)
		}
	}
	patient, plan, stage := syntheticPlan(t, f.pool, f.reception, clinician, f.service)
	var err error
	f.session, err = f.service.Book(t.Context(), f.reception, BookRequest{PatientID: patient, PlanID: plan, StageID: stage, RoomID: f.rooms[0].ID, TherapistID: f.therapists[0], StartsAt: start, EndsAt: start.Add(time.Hour)})
	if err != nil {
		t.Fatal(err)
	}
	return f
}

func (f rescheduleFixture) saved(t *testing.T) Session {
	t.Helper()
	s, err := scanSession(f.pool.QueryRow(t.Context(), `SELECT `+sessionColumns+` FROM therapy_sessions WHERE id=$1`, f.session.ID))
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func (f rescheduleFixture) auditCount(t *testing.T) int {
	t.Helper()
	var n int
	if err := f.pool.QueryRow(t.Context(), `SELECT count(*) FROM audit_events WHERE action='session.rescheduled' AND object_type='therapy_session' AND object_id=$1 AND actor_id=$2`, f.session.ID, f.reception).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestRescheduleConflictIntegrityIntegration(t *testing.T) {
	for _, resource := range []string{"room_only", "therapist_only", "unavailable"} {
		t.Run(resource, func(t *testing.T) {
			f := newRescheduleFixture(t)
			// Move all mutable allocation fields before attempting a rejected edit.
			req := RescheduleRequest{RoomID: f.rooms[1].ID, TherapistID: f.therapists[1], StartsAt: f.session.StartsAt.Add(2 * time.Hour), EndsAt: f.session.EndsAt.Add(2 * time.Hour), Version: f.session.Version}
			moved, err := f.service.Reschedule(t.Context(), f.reception, f.session.ID, req)
			if err != nil {
				t.Fatal(err)
			}
			if moved.RoomID != req.RoomID || moved.TherapistID != req.TherapistID || !moved.StartsAt.Equal(req.StartsAt) || !moved.EndsAt.Equal(req.EndsAt) || moved.Version != f.session.Version+1 {
				t.Fatal("successful reschedule did not save allocation/version")
			}
			before := f.saved(t)
			req.StartsAt, req.EndsAt, req.Version = f.session.StartsAt.Add(4*time.Hour), f.session.EndsAt.Add(4*time.Hour), moved.Version
			if resource == "unavailable" {
				req.StartsAt, req.EndsAt = f.session.StartsAt.Add(9*time.Hour), f.session.EndsAt.Add(9*time.Hour)
			} else {
				room, therapist := f.rooms[0].ID, f.therapists[0]
				if resource == "room_only" {
					room = req.RoomID
				} else {
					therapist = req.TherapistID
				}
				if _, err := f.service.Book(t.Context(), f.reception, BookRequest{PatientID: before.PatientID, PlanID: before.PlanID, StageID: before.StageID, RoomID: room, TherapistID: therapist, StartsAt: req.StartsAt, EndsAt: req.EndsAt}); err != nil {
					t.Fatal(err)
				}
			}
			var snapshot string
			if err := f.pool.QueryRow(t.Context(), `SELECT row_to_json(s)::text FROM therapy_sessions s WHERE id=$1`, before.ID).Scan(&snapshot); err != nil {
				t.Fatal(err)
			}
			if _, err := f.service.Reschedule(t.Context(), f.reception, before.ID, req); !errors.Is(err, ErrConflict) {
				t.Fatalf("rejected reschedule: %v", err)
			}
			var after string
			if err := f.pool.QueryRow(t.Context(), `SELECT row_to_json(s)::text FROM therapy_sessions s WHERE id=$1`, before.ID).Scan(&after); err != nil {
				t.Fatal(err)
			}
			if after != snapshot || !reflect.DeepEqual(f.saved(t), before) || f.auditCount(t) != 1 {
				t.Fatal("rejected reschedule changed saved booking/history or emitted an audit")
			}
		})
	}
}

func TestConcurrentRescheduleVersionIntegration(t *testing.T) {
	f := newRescheduleFixture(t)
	ctx, cancel := context.WithTimeout(t.Context(), 20*time.Second)
	defer cancel()
	gate, err := f.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = gate.Rollback(cleanup)
	}()
	var blocker int
	if err := gate.QueryRow(ctx, `SELECT pg_backend_pid() FROM therapy_sessions WHERE id=$1 FOR UPDATE`, f.session.ID).Scan(&blocker); err != nil {
		t.Fatal(err)
	}
	requests := [2]RescheduleRequest{
		{RoomID: f.rooms[0].ID, TherapistID: f.therapists[0], StartsAt: f.session.StartsAt.Add(2 * time.Hour), EndsAt: f.session.EndsAt.Add(2 * time.Hour), Version: f.session.Version},
		{RoomID: f.rooms[1].ID, TherapistID: f.therapists[1], StartsAt: f.session.StartsAt.Add(4 * time.Hour), EndsAt: f.session.EndsAt.Add(4 * time.Hour), Version: f.session.Version},
	}
	type outcome struct {
		index   int
		session Session
		err     error
	}
	results := make(chan outcome, 2)
	for i, req := range requests {
		go func() {
			s, err := f.service.Reschedule(ctx, f.reception, f.session.ID, req)
			results <- outcome{i, s, err}
		}()
	}
	// Both requests must reach a lock wait before release. The second may wait
	// on the first row-lock waiter; pg_blocking_pids includes that dependency.
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()
	for {
		var waiting int
		if err := f.pool.QueryRow(ctx, `SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND ( $1::integer=ANY(pg_blocking_pids(pid)) OR EXISTS (SELECT 1 FROM pg_stat_activity b WHERE b.pid=ANY(pg_blocking_pids(pg_stat_activity.pid)) AND $1::integer=ANY(pg_blocking_pids(b.pid))))`, blocker).Scan(&waiting); err != nil {
			t.Fatal(err)
		}
		if waiting == 2 {
			break
		}
		select {
		case <-ticker.C:
		case <-ctx.Done():
			t.Fatal("both reschedules did not reach the session lock")
		}
	}
	if err := gate.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	winner, conflicts := -1, 0
	for range requests {
		select {
		case result := <-results:
			if errors.Is(result.err, ErrConflict) {
				conflicts++
				continue
			}
			if result.err != nil {
				t.Fatal(result.err)
			}
			if winner != -1 {
				t.Fatal("both stale-version requests committed")
			}
			winner = result.index
			if !reflect.DeepEqual(f.saved(t), result.session) {
				t.Fatal("saved session differs from successful response")
			}
		case <-ctx.Done():
			t.Fatal("reschedules did not finish")
		}
	}
	if winner < 0 || conflicts != 1 {
		t.Fatalf("winner=%d conflicts=%d", winner, conflicts)
	}
	saved, req := f.saved(t), requests[winner]
	if saved.RoomID != req.RoomID || saved.TherapistID != req.TherapistID || !saved.StartsAt.Equal(req.StartsAt) || !saved.EndsAt.Equal(req.EndsAt) || saved.Version != f.session.Version+1 || saved.Status != "booked" || saved.PatientID != f.session.PatientID || saved.PlanID != f.session.PlanID || saved.StageID != f.session.StageID || f.auditCount(t) != 1 {
		t.Fatal("winner allocation, version, immutable links or audit count incorrect")
	}
}
