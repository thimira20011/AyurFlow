//go:build integration

package scheduling

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Observe a real lock dependency instead of assuming that a goroutine has
// reached a particular SQL statement after an arbitrary sleep.
func waitSchedulingBlocker(t *testing.T, ctx context.Context, pool *pgxpool.Pool, blocker uint32) uint32 {
	t.Helper()
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()
	for {
		var pid uint32
		err := pool.QueryRow(ctx, `SELECT pid FROM pg_stat_activity
			WHERE datname=current_database() AND wait_event_type='Lock'
			AND $1::integer=ANY(pg_blocking_pids(pid)) LIMIT 1`, int64(blocker)).Scan(&pid)
		if err == nil {
			return pid
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			t.Fatalf("inspect scheduling lock dependency: %v", err)
		}
		select {
		case <-ticker.C:
		case <-ctx.Done():
			t.Fatalf("did not observe a scheduling request blocked by backend %d: %v", blocker, ctx.Err())
		}
	}
}

func TestAvailabilityBookingInterleavingsIntegration(t *testing.T) {
	for _, resource := range []string{"room", "therapist"} {
		for _, bookingFirst := range []bool{true, false} {
			order := "edit_first"
			if bookingFirst {
				order = "booking_first"
			}
			t.Run(resource+"/"+order, func(t *testing.T) {
				pool := testutil.Postgres(t)
				service := NewService(pool)
				reception := seedStaff(t, pool, "availability-reception", "receptionist")
				clinician := seedStaff(t, pool, "availability-clinician", "clinician")
				therapist := seedStaff(t, pool, "availability-therapist", "therapist")
				patient, plan, stage := syntheticPlan(t, pool, reception, clinician, service)
				room, err := service.CreateRoom(t.Context(), reception, "AVAILABILITY", "Synthetic availability room")
				if err != nil {
					t.Fatal(err)
				}
				start := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Minute)
				end := start.Add(time.Hour)
				windowStart, windowEnd := start.Add(-time.Hour), end.Add(time.Hour)
				roomWindow, err := service.AddAvailability(t.Context(), reception, &room.ID, nil, windowStart, windowEnd)
				if err != nil {
					t.Fatal(err)
				}
				therapistWindow, err := service.AddAvailability(t.Context(), reception, nil, &therapist, windowStart, windowEnd)
				if err != nil {
					t.Fatal(err)
				}
				window := roomWindow
				if resource == "therapist" {
					window = therapistWindow
				}
				// The changed window would exclude the requested session completely.
				changedStart := end.Add(30 * time.Minute)
				request := BookRequest{PatientID: patient, PlanID: plan, StageID: stage,
					RoomID: room.ID, TherapistID: therapist, StartsAt: start, EndsAt: end}
				ctx, cancel := context.WithTimeout(t.Context(), 20*time.Second)
				defer cancel()
				gate, err := pool.Begin(ctx)
				if err != nil {
					t.Fatal(err)
				}
				defer func() {
					cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
					defer stop()
					_ = gate.Rollback(cleanup)
				}()
				gatePID := gate.Conn().PgConn().PID()
				if _, err := gate.Exec(ctx, `SELECT pg_advisory_xact_lock($1::bigint)`, int64(gatePID)); err != nil {
					t.Fatal(err)
				}
				// Test-only triggers pause the winning mutation after it acquired its
				// production locks, while allowing the other service call to reach SQL.
				if _, err := pool.Exec(ctx, `CREATE FUNCTION scheduling_test_gate() RETURNS trigger LANGUAGE plpgsql AS $$
					BEGIN PERFORM pg_advisory_xact_lock(TG_ARGV[0]::bigint); RETURN NEW; END; $$`); err != nil {
					t.Fatal(err)
				}
				triggerTarget := "BEFORE UPDATE ON resource_availability"
				if bookingFirst {
					triggerTarget = "BEFORE INSERT ON therapy_sessions"
				}
				if _, err := pool.Exec(ctx, fmt.Sprintf(`CREATE TRIGGER scheduling_test_pause %s
					FOR EACH ROW EXECUTE FUNCTION scheduling_test_gate('%d')`, triggerTarget, gatePID)); err != nil {
					t.Fatal(err)
				}
				bookingResult := make(chan error, 1)
				editResult := make(chan error, 1)
				book := func() {
					_, err := service.Book(ctx, reception, request)
					bookingResult <- err
				}
				edit := func() {
					_, err := service.ChangeAvailability(ctx, reception, window.ID, changedStart, windowEnd)
					editResult <- err
				}
				if bookingFirst {
					go book()
				} else {
					go edit()
				}
				firstPID := waitSchedulingBlocker(t, ctx, pool, gatePID)
				if bookingFirst {
					go edit()
				} else {
					go book()
				}
				_ = waitSchedulingBlocker(t, ctx, pool, firstPID)
				if err := gate.Commit(ctx); err != nil {
					t.Fatal(err)
				}
				collect := func(result <-chan error) error {
					select {
					case err := <-result:
						return err
					case <-ctx.Done():
						t.Fatal("availability/booking operations did not finish before deadline")
						return ctx.Err()
					}
				}
				bookingErr, editErr := collect(bookingResult), collect(editResult)
				wantBookings, wantEdits := 0, 1
				wantStart := changedStart
				if bookingFirst {
					wantBookings, wantEdits, wantStart = 1, 0, windowStart
					if bookingErr != nil || !errors.Is(editErr, ErrConflict) {
						t.Fatalf("booking first: booking=%v edit=%v", bookingErr, editErr)
					}
				} else if editErr != nil || !errors.Is(bookingErr, ErrConflict) {
					t.Fatalf("edit first: booking=%v edit=%v", bookingErr, editErr)
				}
				var savedStart, savedEnd time.Time
				if err := pool.QueryRow(ctx, `SELECT starts_at,ends_at FROM resource_availability WHERE id=$1`, window.ID).Scan(&savedStart, &savedEnd); err != nil {
					t.Fatal(err)
				}
				if !savedStart.Equal(wantStart) || !savedEnd.Equal(windowEnd) {
					t.Fatal("availability does not match the winning operation; rejected edit changed committed state")
				}
				var sessions, bookingAudits, editAudits, uncovered int
				if err := pool.QueryRow(ctx, `SELECT
					(SELECT count(*) FROM therapy_sessions),
					(SELECT count(*) FROM audit_events WHERE action='session.booked' AND actor_id=$1),
					(SELECT count(*) FROM audit_events WHERE action='availability.changed' AND object_id=$2 AND actor_id=$1),
					(SELECT count(*) FROM therapy_sessions s WHERE s.status IN ('booked','in_progress') AND (
						NOT EXISTS(SELECT 1 FROM resource_availability a WHERE a.room_id=s.room_id AND a.starts_at<=s.starts_at AND a.ends_at>=s.ends_at)
						OR NOT EXISTS(SELECT 1 FROM resource_availability a WHERE a.therapist_id=s.therapist_id AND a.starts_at<=s.starts_at AND a.ends_at>=s.ends_at)))`,
					reception, window.ID).Scan(&sessions, &bookingAudits, &editAudits, &uncovered); err != nil {
					t.Fatal(err)
				}
				if sessions != wantBookings || bookingAudits != wantBookings || editAudits != wantEdits || uncovered != 0 {
					t.Fatalf("sessions=%d booking audits=%d edit audits=%d uncovered=%d; want %d/%d/%d/0", sessions, bookingAudits, editAudits, uncovered, wantBookings, wantBookings, wantEdits)
				}
			})
		}
	}
}
