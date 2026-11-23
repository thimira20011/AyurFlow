//go:build integration

package scheduling

import (
	"context"
	"errors"
	"testing"
	"time"

	"ayurflow/backend/internal/testutil"
)

// Different clinical plans avoid an unrelated shared plan being the reason that
// requests serialize. Each conflict case shares exactly one scheduling resource.
func TestBookingResourceConstraintsIntegration(t *testing.T) {
	for _, tc := range []struct {
		name                        string
		sharedRoom, sharedTherapist bool
		offset                      time.Duration
		wantCommitted               int
	}{
		{"room_only_overlap", true, false, 30 * time.Minute, 1},
		{"therapist_only_overlap", false, true, 30 * time.Minute, 1},
		{"independent_resources_overlap", false, false, 30 * time.Minute, 2},
		{"adjacent_after", true, true, time.Hour, 2},
		{"adjacent_before", true, true, -time.Hour, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			pool := testutil.Postgres(t)
			service := NewService(pool)
			reception := seedStaff(t, pool, "resource-reception", "receptionist")
			clinician := seedStaff(t, pool, "resource-clinician", "clinician")
			therapists := [2]string{
				seedStaff(t, pool, "resource-therapist-a", "therapist"),
				seedStaff(t, pool, "resource-therapist-b", "therapist"),
			}
			var rooms [2]Room
			for i, code := range []string{"RESOURCE-A", "RESOURCE-B"} {
				var err error
				rooms[i], err = service.CreateRoom(t.Context(), reception, code, "Synthetic resource room")
				if err != nil {
					t.Fatal(err)
				}
			}
			start := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Minute)
			for i := range rooms {
				if _, err := service.AddAvailability(t.Context(), reception, &rooms[i].ID, nil, start.Add(-2*time.Hour), start.Add(4*time.Hour)); err != nil {
					t.Fatal(err)
				}
				if _, err := service.AddAvailability(t.Context(), reception, nil, &therapists[i], start.Add(-2*time.Hour), start.Add(4*time.Hour)); err != nil {
					t.Fatal(err)
				}
			}
			var requests [2]BookRequest
			for i := range requests {
				patient, plan, stage := syntheticPlan(t, pool, reception, clinician, service)
				requests[i] = BookRequest{
					PatientID: patient, PlanID: plan, StageID: stage,
					RoomID: rooms[i].ID, TherapistID: therapists[i],
					StartsAt: start, EndsAt: start.Add(time.Hour),
				}
			}
			if tc.sharedRoom {
				requests[1].RoomID = requests[0].RoomID
			}
			if tc.sharedTherapist {
				requests[1].TherapistID = requests[0].TherapistID
			}
			requests[1].StartsAt = requests[1].StartsAt.Add(tc.offset)
			requests[1].EndsAt = requests[1].EndsAt.Add(tc.offset)

			ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
			defer cancel()
			type outcome struct {
				index   int
				session Session
				err     error
			}
			ready := make(chan struct{}, len(requests))
			release := make(chan struct{})
			results := make(chan outcome, len(requests))
			for i, request := range requests {
				go func() {
					ready <- struct{}{}
					<-release
					session, err := service.Book(ctx, reception, request)
					results <- outcome{index: i, session: session, err: err}
				}()
			}
			for range requests {
				<-ready
			}
			close(release)
			committed, conflicts := 0, 0
			for range requests {
				var result outcome
				select {
				case result = <-results:
				case <-ctx.Done():
					t.Fatal("concurrent booking requests did not finish before deadline")
				}
				if errors.Is(result.err, ErrConflict) {
					conflicts++
					continue
				}
				if result.err != nil {
					t.Fatalf("request %d: %v", result.index, result.err)
				}
				committed++
				request := requests[result.index]
				persisted, err := scanSession(pool.QueryRow(ctx, `SELECT `+sessionColumns+` FROM therapy_sessions WHERE id=$1`, result.session.ID))
				if err != nil {
					t.Fatal(err)
				}
				if persisted.PatientID != request.PatientID || persisted.PlanID != request.PlanID || persisted.StageID != request.StageID ||
					persisted.RoomID != request.RoomID || persisted.TherapistID != request.TherapistID ||
					!persisted.StartsAt.Equal(request.StartsAt) || !persisted.EndsAt.Equal(request.EndsAt) ||
					persisted.Status != "booked" || persisted.Version != 1 {
					t.Fatal("committed booking differs from the successful request")
				}
			}
			if committed != tc.wantCommitted || conflicts != len(requests)-tc.wantCommitted {
				t.Fatalf("committed=%d conflicts=%d; want %d committed and %d conflicts", committed, conflicts, tc.wantCommitted, len(requests)-tc.wantCommitted)
			}
			var saved, audited, missingAudit, orphanAudit int
			if err := pool.QueryRow(ctx, `SELECT
				(SELECT count(*) FROM therapy_sessions),
				(SELECT count(*) FROM audit_events WHERE action='session.booked'),
				(SELECT count(*) FROM therapy_sessions s WHERE NOT EXISTS (
					SELECT 1 FROM audit_events a WHERE a.action='session.booked' AND a.object_type='therapy_session'
					AND a.object_id=s.id::text AND a.actor_id=$1)),
				(SELECT count(*) FROM audit_events a WHERE a.action='session.booked' AND NOT EXISTS (
					SELECT 1 FROM therapy_sessions s WHERE s.id::text=a.object_id))`, reception).Scan(&saved, &audited, &missingAudit, &orphanAudit); err != nil {
				t.Fatal(err)
			}
			if saved != tc.wantCommitted || audited != tc.wantCommitted || missingAudit != 0 || orphanAudit != 0 {
				t.Fatalf("saved=%d audited=%d missing audit=%d orphan audit=%d; want %d matching booking/audit pairs", saved, audited, missingAudit, orphanAudit, tc.wantCommitted)
			}
		})
	}
}
