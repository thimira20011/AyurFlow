//go:build integration

package scheduling

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"ayurflow/backend/internal/clinical"
	"ayurflow/backend/internal/testutil"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type clearanceFixture struct {
	pool                                  *pgxpool.Pool
	sessions                              *Service
	plans                                 *clinical.Service
	reception, clinician, therapist, plan string
	version                               int64
	booked                                [2]Session
}

func newClearanceFixture(t *testing.T) clearanceFixture {
	t.Helper()
	f := clearanceFixture{pool: testutil.Postgres(t)}
	f.sessions = NewService(f.pool)
	f.plans = clinical.NewService(f.pool, clinical.MemberBPathway(), f.sessions, f.sessions)
	f.reception = seedStaff(t, f.pool, "clearance-reception", "receptionist")
	f.clinician = seedStaff(t, f.pool, "clearance-clinician", "clinician")
	f.therapist = seedStaff(t, f.pool, "clearance-therapist", "therapist")
	patient, plan, stage := syntheticPlan(t, f.pool, f.reception, f.clinician, f.sessions)
	f.plan = plan
	if err := f.pool.QueryRow(t.Context(), `SELECT record_version FROM care_plans WHERE id=$1`, plan).Scan(&f.version); err != nil {
		t.Fatal(err)
	}
	room, err := f.sessions.CreateRoom(t.Context(), f.reception, "CLEARANCE", "Synthetic clearance room")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Minute)
	for _, resource := range []struct{ room, therapist *string }{{&room.ID, nil}, {nil, &f.therapist}} {
		if _, err := f.sessions.AddAvailability(t.Context(), f.reception, resource.room, resource.therapist, start, start.Add(6*time.Hour)); err != nil {
			t.Fatal(err)
		}
	}
	for i := range f.booked {
		slot := start.Add(time.Duration(i) * 2 * time.Hour)
		f.booked[i], err = f.sessions.Book(t.Context(), f.reception, BookRequest{PatientID: patient, PlanID: plan, StageID: stage, RoomID: room.ID, TherapistID: f.therapist, StartsAt: slot, EndsAt: slot.Add(time.Hour)})
		if err != nil {
			t.Fatal(err)
		}
	}
	return f
}

// Inspect actual blocking rather than relying on goroutine timing or sleeps.
func waitClearanceBlocker(t *testing.T, ctx context.Context, pool *pgxpool.Pool, blocker uint32) uint32 {
	t.Helper()
	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()
	for {
		var pid uint32
		err := pool.QueryRow(ctx, `SELECT pid FROM pg_stat_activity WHERE datname=current_database()
			AND wait_event_type='Lock' AND $1::integer=ANY(pg_blocking_pids(pid)) LIMIT 1`, int64(blocker)).Scan(&pid)
		if err == nil {
			return pid
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			t.Fatal(err)
		}
		select {
		case <-ticker.C:
		case <-ctx.Done():
			t.Fatalf("no clearance request blocked by backend %d: %v", blocker, ctx.Err())
		}
	}
}

func TestSessionStartPlanDecisionInterleavingsIntegration(t *testing.T) {
	for _, decision := range []string{"hold", "cancel"} {
		for _, startFirst := range []bool{true, false} {
			order := "decision_first"
			if startFirst {
				order = "start_first"
			}
			t.Run(decision+"/"+order, func(t *testing.T) {
				f := newClearanceFixture(t)
				ctx, cancel := context.WithTimeout(t.Context(), 20*time.Second)
				defer cancel()
				gate, err := f.pool.Begin(ctx)
				if err != nil {
					t.Fatal(err)
				}
				defer func() {
					cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
					defer stop()
					_ = gate.Rollback(cleanup)
				}()
				pid := gate.Conn().PgConn().PID()
				if _, err := gate.Exec(ctx, `SELECT pg_advisory_xact_lock($1::bigint)`, int64(pid)); err != nil {
					t.Fatal(err)
				}
				if _, err := f.pool.Exec(ctx, `CREATE FUNCTION clearance_test_gate() RETURNS trigger LANGUAGE plpgsql AS $$
					BEGIN PERFORM pg_advisory_xact_lock(TG_ARGV[0]::bigint); RETURN NEW; END; $$`); err != nil {
					t.Fatal(err)
				}
				target := "care_plans"
				if startFirst {
					target = "therapy_sessions"
				}
				// Both triggers pause after the production plan lock is held.
				if _, err := f.pool.Exec(ctx, fmt.Sprintf(`CREATE TRIGGER clearance_test_pause BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION clearance_test_gate('%d')`, target, pid)); err != nil {
					t.Fatal(err)
				}
				startResult, decisionResult := make(chan error, 1), make(chan error, 1)
				start := func() { _, err := f.sessions.Start(ctx, f.therapist, f.booked[0].ID); startResult <- err }
				change := func() {
					var err error
					if decision == "hold" {
						_, err = f.plans.Hold(ctx, f.clinician, f.plan, f.version, "Synthetic clinical pause")
					} else {
						_, err = f.plans.Cancel(ctx, f.clinician, f.plan, f.version, "Synthetic cancellation")
					}
					decisionResult <- err
				}
				if startFirst {
					go start()
				} else {
					go change()
				}
				first := waitClearanceBlocker(t, ctx, f.pool, pid)
				if startFirst {
					go change()
				} else {
					go start()
				}
				_ = waitClearanceBlocker(t, ctx, f.pool, first)
				if err := gate.Commit(ctx); err != nil {
					t.Fatal(err)
				}
				collect := func(result <-chan error) error {
					select {
					case err := <-result:
						return err
					case <-ctx.Done():
						t.Fatal("start/decision did not finish")
						return ctx.Err()
					}
				}
				startErr, decisionErr := collect(startResult), collect(decisionResult)
				if decisionErr != nil {
					t.Fatalf("plan decision: %v", decisionErr)
				}
				if startFirst && startErr != nil || !startFirst && !errors.Is(startErr, ErrConflict) {
					t.Fatalf("start-first=%v start=%v", startFirst, startErr)
				}
				if _, err := f.pool.Exec(ctx, `DROP TRIGGER clearance_test_pause ON `+target); err != nil {
					t.Fatal(err)
				}
				wantStatus := "held"
				if decision == "cancel" {
					wantStatus = "cancelled"
				}
				var status string
				var version int64
				if err := f.pool.QueryRow(ctx, `SELECT status,record_version FROM care_plans WHERE id=$1`, f.plan).Scan(&status, &version); err != nil {
					t.Fatal(err)
				}
				if status != wantStatus || version != f.version+1 {
					t.Fatal("plan decision/version not committed once")
				}
				wantCancelled, wantStarted := 0, 0
				if startFirst {
					wantStarted = 1
				}
				if decision == "cancel" {
					wantCancelled = 2 - wantStarted
				}
				for i, original := range f.booked {
					saved, err := scanSession(f.pool.QueryRow(ctx, `SELECT `+sessionColumns+` FROM therapy_sessions WHERE id=$1`, original.ID))
					if err != nil {
						t.Fatal(err)
					}
					wantSession, wantVersion := "booked", original.Version
					if startFirst && i == 0 {
						wantSession, wantVersion = "in_progress", original.Version+1
					} else if decision == "cancel" {
						wantSession, wantVersion = "cancelled", original.Version+1
					}
					if saved.Status != wantSession || saved.Version != wantVersion || saved.PatientID != original.PatientID || saved.PlanID != original.PlanID || saved.StageID != original.StageID || saved.RoomID != original.RoomID || saved.TherapistID != original.TherapistID || !saved.StartsAt.Equal(original.StartsAt) || !saved.EndsAt.Equal(original.EndsAt) {
						t.Fatal("plan decision changed allocation/history or session state incorrectly")
					}
					var starts, cancels int
					if err := f.pool.QueryRow(ctx, `SELECT count(*) FILTER(WHERE action='session.started' AND actor_id=$2),count(*) FILTER(WHERE action='session.cancelled' AND actor_id=$3) FROM audit_events WHERE object_type='therapy_session' AND object_id=$1`, original.ID, f.therapist, f.clinician).Scan(&starts, &cancels); err != nil {
						t.Fatal(err)
					}
					wantStartAudit, wantCancelAudit := 0, 0
					if wantSession == "in_progress" {
						wantStartAudit = 1
					}
					if wantSession == "cancelled" {
						wantCancelAudit = 1
					}
					if starts != wantStartAudit || cancels != wantCancelAudit {
						t.Fatal("session audit does not match committed state/actor")
					}
				}
				var decisions, decisionAudits, starts, cancels int
				if err := f.pool.QueryRow(ctx, `SELECT
					(SELECT count(*) FROM plan_decisions WHERE plan_id=$1 AND action=$2 AND actor_id=$3),
					(SELECT count(*) FROM audit_events WHERE object_id=$1::text AND action='plan.'||$2 AND actor_id=$3),
					(SELECT count(*) FROM audit_events WHERE action='session.started'),
					(SELECT count(*) FROM audit_events WHERE action='session.cancelled')`, f.plan, decision, f.clinician).Scan(&decisions, &decisionAudits, &starts, &cancels); err != nil {
					t.Fatal(err)
				}
				if decisions != 1 || decisionAudits != 1 || starts != wantStarted || cancels != wantCancelled {
					t.Fatal("decision/session audits not atomic or rejected start emitted an audit")
				}
				if _, err := f.sessions.Start(ctx, f.therapist, f.booked[1].ID); !errors.Is(err, ErrConflict) {
					t.Fatalf("new start after decision: %v", err)
				}
				// Completion during cancellation remains an undecided policy gate.
				if decision == "hold" && startFirst {
					completed, err := f.sessions.Complete(ctx, f.therapist, f.booked[0].ID, "Synthetic delivery during hold")
					if err != nil || completed.Status != "completed" {
						t.Fatalf("completion during hold: %v", err)
					}
				}
			})
		}
	}
}

func TestPlanCancellationSessionAuditRollbackIntegration(t *testing.T) {
	f := newClearanceFixture(t)
	if _, err := f.sessions.Start(t.Context(), f.therapist, f.booked[0].ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.sessions.Complete(t.Context(), f.therapist, f.booked[0].ID, "Synthetic retained delivery"); err != nil {
		t.Fatal(err)
	}
	snapshot := func() string {
		t.Helper()
		var saved string
		if err := f.pool.QueryRow(t.Context(), `SELECT json_build_array(
			(SELECT json_agg(p ORDER BY id) FROM care_plans p),
			(SELECT json_agg(d ORDER BY id) FROM plan_decisions d),
			(SELECT json_agg(s ORDER BY id) FROM therapy_sessions s),
			(SELECT json_agg(a ORDER BY id) FROM audit_events a))::text`).Scan(&saved); err != nil {
			t.Fatal(err)
		}
		return saved
	}
	before := snapshot()
	var deliveredBefore string
	if err := f.pool.QueryRow(t.Context(), `SELECT row_to_json(s)::text FROM therapy_sessions s WHERE id=$1`, f.booked[0].ID).Scan(&deliveredBefore); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(t.Context(), `CREATE FUNCTION reject_clearance_cancel_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN IF NEW.action='plan.cancel' THEN RAISE EXCEPTION 'synthetic cancellation audit failure'; END IF; RETURN NEW; END; $$;
		CREATE TRIGGER reject_clearance_cancel BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_clearance_cancel_audit()`); err != nil {
		t.Fatal(err)
	}
	var failure *pgconn.PgError
	if _, err := f.plans.Cancel(t.Context(), f.clinician, f.plan, f.version, "Synthetic cancellation"); !errors.As(err, &failure) || failure.Code != "P0001" {
		t.Fatalf("did not reach failing plan audit: %v", err)
	}
	if snapshot() != before {
		t.Fatal("failed final audit committed plan, decision, session cancellation or audit history")
	}
	if _, err := f.pool.Exec(t.Context(), `DROP TRIGGER reject_clearance_cancel ON audit_events`); err != nil {
		t.Fatal(err)
	}
	if _, err := f.plans.Cancel(t.Context(), f.clinician, f.plan, f.version, "Synthetic cancellation retry"); err != nil {
		t.Fatal(err)
	}
	var completed, cancelled int
	if err := f.pool.QueryRow(t.Context(), `SELECT count(*) FILTER(WHERE status='completed'),count(*) FILTER(WHERE status='cancelled') FROM therapy_sessions WHERE plan_id=$1`, f.plan).Scan(&completed, &cancelled); err != nil {
		t.Fatal(err)
	}
	if completed != 1 || cancelled != 1 {
		t.Fatal("retry did not retain delivery history and cancel future booking")
	}
	var deliveredAfter string
	if err := f.pool.QueryRow(t.Context(), `SELECT row_to_json(s)::text FROM therapy_sessions s WHERE id=$1`, f.booked[0].ID).Scan(&deliveredAfter); err != nil {
		t.Fatal(err)
	}
	if deliveredAfter != deliveredBefore {
		t.Fatal("successful cancellation changed completed delivery history")
	}
}
