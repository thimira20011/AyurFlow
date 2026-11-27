//go:build integration

package http

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"ayurflow/backend/internal/clinical"
	"ayurflow/backend/internal/scheduling"
)

type deliveryActor struct{ id, token, csrf string }

type deliveryHTTPFixture struct {
	protectedFixture
	assigned, other, admin, clinician deliveryActor
	booked                            [2]scheduling.Session
}

func newDeliveryHTTPFixture(t *testing.T) deliveryHTTPFixture {
	t.Helper()
	f := deliveryHTTPFixture{protectedFixture: newProtectedFixture(t)}
	patient := createProtectedPatient(t, f.protectedFixture)
	actor := func(login, role string) deliveryActor {
		t.Helper()
		var result deliveryActor
		if err := f.pool.QueryRow(t.Context(), `INSERT INTO staff_accounts(login_identifier,password_hash)
			SELECT $1,password_hash FROM staff_accounts WHERE id=$2 RETURNING id::text`, login, f.actor).Scan(&result.id); err != nil {
			t.Fatal(err)
		}
		if _, err := f.pool.Exec(t.Context(), `INSERT INTO staff_roles(staff_id,role_code) VALUES($1,$2)`, result.id, role); err != nil {
			t.Fatal(err)
		}
		session, token, err := f.sessions.Login(t.Context(), login, "synthetic-password-for-http-tests", "")
		if err != nil {
			t.Fatal(err)
		}
		result.token, result.csrf = token, session.CSRFToken
		return result
	}
	f.assigned = actor("delivery-assigned", "therapist")
	f.other = actor("delivery-other", "therapist")
	f.admin = actor("delivery-admin", "administrator")
	f.clinician = actor("delivery-clinician", "clinician")
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO patient_clinician_assignments(patient_id,clinician_id,granted_by) VALUES($1,$2,$3)`, patient.ID, f.clinician.id, f.actor); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO consultations(patient_id,status,draft_text,signed_text,signed_by,signed_at,created_by,updated_by)
		VALUES($1,'signed',NULL,'Synthetic delivery assessment',$2,clock_timestamp(),$2,$2)`, patient.ID, f.clinician.id); err != nil {
		t.Fatal(err)
	}
	schedule := scheduling.NewService(f.pool)
	plans := clinical.NewService(f.pool, clinical.MemberBPathway(), schedule, schedule)
	plan, err := plans.Create(t.Context(), f.clinician.id, patient.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	plan, err = plans.Start(t.Context(), f.clinician.id, plan.ID, plan.Version)
	if err != nil {
		t.Fatal(err)
	}
	var stage string
	if err := f.pool.QueryRow(t.Context(), `SELECT id::text FROM plan_stages WHERE plan_id=$1 AND ordinal=1`, plan.ID).Scan(&stage); err != nil {
		t.Fatal(err)
	}
	if _, err := plans.Approve(t.Context(), f.clinician.id, plan.ID, stage, plan.Version, clinical.MemberBPathway()[0].RequiredChecks); err != nil {
		t.Fatal(err)
	}
	room, err := schedule.CreateRoom(t.Context(), f.actor, "DELIVERY-HTTP", "Synthetic delivery room")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now().UTC().Add(48 * time.Hour).Truncate(time.Minute)
	for _, resource := range []struct{ room, therapist *string }{{&room.ID, nil}, {nil, &f.assigned.id}} {
		if _, err := schedule.AddAvailability(t.Context(), f.actor, resource.room, resource.therapist, start, start.Add(4*time.Hour)); err != nil {
			t.Fatal(err)
		}
	}
	for i := range f.booked {
		slot := start.Add(time.Duration(i) * 2 * time.Hour)
		f.booked[i], err = schedule.Book(t.Context(), f.actor, scheduling.BookRequest{PatientID: patient.ID, PlanID: plan.ID, StageID: stage, RoomID: room.ID, TherapistID: f.assigned.id, StartsAt: slot, EndsAt: slot.Add(time.Hour)})
		if err != nil {
			t.Fatal(err)
		}
	}
	f.router = NewRouter(f.pool, AuthRoutes{Service: f.sessions, AllowedOrigin: protectedOrigin, Scheduling: schedule})
	return f
}

func (f deliveryHTTPFixture) snapshot(t *testing.T) string {
	t.Helper()
	var result string
	if err := f.pool.QueryRow(t.Context(), `SELECT json_build_array(
		(SELECT json_agg(s ORDER BY id) FROM therapy_sessions s),
		(SELECT json_agg(a ORDER BY id) FROM audit_events a WHERE action LIKE 'session.%'))::text`).Scan(&result); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestSchedulingDeliveryHTTPPermissionsIntegration(t *testing.T) {
	f := newDeliveryHTTPFixture(t)
	for _, action := range []string{"start", "complete"} {
		if action == "complete" {
			response := protectedRequest(f.router, http.MethodPost, "/api/v1/sessions/"+f.booked[0].ID+"/start", f.assigned.token, f.assigned.csrf, "")
			if response.Code != http.StatusOK {
				t.Fatalf("assigned start status=%d", response.Code)
			}
		}
		path := "/api/v1/sessions/" + f.booked[0].ID + "/" + action
		body := `{"observations":"Synthetic private delivery"}`
		for _, tc := range []struct {
			name, token, csrf string
			want              int
		}{
			{"anonymous", "", "", http.StatusUnauthorized},
			{"missing_csrf", f.assigned.token, "", http.StatusForbidden},
			{"wrong_csrf", f.assigned.token, f.token, http.StatusForbidden},
			{"unassigned_therapist", f.other.token, f.other.csrf, http.StatusNotFound},
			{"reception", f.token, f.csrf, http.StatusNotFound},
			{"administrator_only", f.admin.token, f.admin.csrf, http.StatusNotFound},
			{"assigned_clinician", f.clinician.token, f.clinician.csrf, http.StatusNotFound},
		} {
			t.Run(action+"/"+tc.name, func(t *testing.T) {
				before := f.snapshot(t)
				response := protectedRequest(f.router, http.MethodPost, path, tc.token, tc.csrf, body)
				if response.Code != tc.want {
					t.Fatalf("status=%d want=%d", response.Code, tc.want)
				}
				if f.snapshot(t) != before {
					t.Fatal("rejected request changed session or business audit history")
				}
				if strings.Contains(response.Body.String(), "Synthetic private delivery") || strings.Contains(response.Body.String(), f.booked[0].PatientID) {
					t.Fatal("denial disclosed delivery data")
				}
			})
		}
		t.Run(action+"/disabled_assigned_therapist", func(t *testing.T) {
			if _, err := f.pool.Exec(t.Context(), `UPDATE staff_accounts SET active=false WHERE id=$1`, f.assigned.id); err != nil {
				t.Fatal(err)
			}
			before := f.snapshot(t)
			response := protectedRequest(f.router, http.MethodPost, path, f.assigned.token, f.assigned.csrf, body)
			if response.Code != http.StatusUnauthorized || f.snapshot(t) != before {
				t.Fatal("disabled therapist retained access or changed history")
			}
			if _, err := f.pool.Exec(t.Context(), `UPDATE staff_accounts SET active=true WHERE id=$1`, f.assigned.id); err != nil {
				t.Fatal(err)
			}
			// Disabling may revoke a session. Obtain a fresh session for the next phase.
			session, token, err := f.sessions.Login(t.Context(), "delivery-assigned", "synthetic-password-for-http-tests", "")
			if err != nil {
				t.Fatal(err)
			}
			f.assigned.token, f.assigned.csrf = token, session.CSRFToken
		})
	}
}

func TestSchedulingDeliveryHTTPLifecycleIntegration(t *testing.T) {
	f := newDeliveryHTTPFixture(t)
	path := "/api/v1/sessions/" + f.booked[0].ID
	reject := func(name, suffix, token, csrf, body string, want int) {
		t.Helper()
		t.Run(name, func(t *testing.T) {
			before := f.snapshot(t)
			response := protectedRequest(f.router, http.MethodPost, path+suffix, token, csrf, body)
			if response.Code != want || f.snapshot(t) != before {
				t.Fatalf("rejection status=%d want=%d or committed history changed", response.Code, want)
			}
		})
	}
	reject("complete_before_start", "/complete", f.assigned.token, f.assigned.csrf, `{"observations":"Synthetic early completion"}`, http.StatusConflict)
	response := protectedRequest(f.router, http.MethodPost, path+"/start", f.assigned.token, f.assigned.csrf, "")
	if response.Code != http.StatusOK {
		t.Fatalf("start status=%d", response.Code)
	}
	reject("repeated_start", "/start", f.assigned.token, f.assigned.csrf, "", http.StatusConflict)
	reject("cancel_running", "/cancel", f.token, f.csrf, `{"reason":"Synthetic rejected cancellation"}`, http.StatusConflict)
	for _, tc := range []struct {
		name, body string
		want       int
	}{
		{"blank_observations", `{"observations":"   "}`, http.StatusUnprocessableEntity},
		{"oversized_observations", `{"observations":"` + strings.Repeat("x", 8001) + `"}`, http.StatusUnprocessableEntity},
		{"unknown_field", `{"observations":"Synthetic","actorId":"forged"}`, http.StatusBadRequest},
		{"trailing_json", `{"observations":"Synthetic"} {}`, http.StatusBadRequest},
	} {
		reject(tc.name, "/complete", f.assigned.token, f.assigned.csrf, tc.body, tc.want)
	}
	const observation = "Synthetic delivery: ආයු ප්‍රතිකාර · சிகிச்சை complete"
	body, err := json.Marshal(map[string]string{"observations": observation})
	if err != nil {
		t.Fatal(err)
	}
	response = protectedRequest(f.router, http.MethodPost, path+"/complete", f.assigned.token, f.assigned.csrf, string(body))
	if response.Code != http.StatusOK {
		t.Fatalf("complete status=%d", response.Code)
	}
	var completed scheduling.Session
	if err := json.Unmarshal(response.Body.Bytes(), &completed); err != nil {
		t.Fatal(err)
	}
	if completed.Status != "completed" || completed.Version != f.booked[0].Version+2 || completed.Observations == nil || *completed.Observations != observation {
		t.Fatal("completion response lost Unicode/status/version")
	}
	var saved string
	if err := f.pool.QueryRow(t.Context(), `SELECT observations FROM therapy_sessions WHERE id=$1`, f.booked[0].ID).Scan(&saved); err != nil || saved != observation {
		t.Fatal("saved Unicode observations differ from response")
	}
	listPath := "/api/v1/sessions?start=" + f.booked[0].StartsAt.Format(time.RFC3339) + "&end=" + f.booked[0].EndsAt.Format(time.RFC3339)
	for _, tc := range []struct {
		name, token           string
		wantStatus, wantItems int
		clinical              bool
	}{
		{"reception_projection", f.token, http.StatusOK, 1, false},
		{"assigned_therapist_projection", f.assigned.token, http.StatusOK, 1, true},
		{"assigned_clinician_projection", f.clinician.token, http.StatusOK, 1, true},
		{"other_therapist_projection", f.other.token, http.StatusOK, 0, false},
		{"administrator_projection", f.admin.token, http.StatusNotFound, 0, false},
		{"anonymous_projection", "", http.StatusUnauthorized, 0, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := f.snapshot(t)
			response := protectedRequest(f.router, http.MethodGet, listPath, tc.token, "", "")
			if response.Code != tc.wantStatus {
				t.Fatalf("read status=%d want=%d", response.Code, tc.wantStatus)
			}
			if response.Code == http.StatusOK {
				var result struct {
					Items []scheduling.Session `json:"items"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
					t.Fatal(err)
				}
				if len(result.Items) != tc.wantItems {
					t.Fatal("read exposed an unrelated session or omitted assigned record")
				}
				for _, item := range result.Items {
					if tc.clinical && (item.Observations == nil || *item.Observations != observation) || !tc.clinical && item.Observations != nil {
						t.Fatal("HTTP projection did not enforce observation access")
					}
				}
			}
			if f.snapshot(t) != before {
				t.Fatal("read changed committed session/history")
			}
		})
	}
	reject("rewrite_completed", "/complete", f.assigned.token, f.assigned.csrf, `{"observations":"Synthetic rewrite"}`, http.StatusConflict)
	reject("restart_completed", "/start", f.assigned.token, f.assigned.csrf, "", http.StatusConflict)
	reject("cancel_completed", "/cancel", f.token, f.csrf, `{"reason":"Synthetic history rewrite"}`, http.StatusConflict)
	path = "/api/v1/sessions/" + f.booked[1].ID
	response = protectedRequest(f.router, http.MethodPost, path+"/cancel", f.token, f.csrf, `{"reason":"Synthetic reception cancellation"}`)
	if response.Code != http.StatusOK {
		t.Fatalf("cancel booked status=%d", response.Code)
	}
	reject("start_cancelled", "/start", f.assigned.token, f.assigned.csrf, "", http.StatusConflict)
	reject("complete_cancelled", "/complete", f.assigned.token, f.assigned.csrf, string(body), http.StatusConflict)
	reject("repeat_cancellation", "/cancel", f.token, f.csrf, `{"reason":"Synthetic retry"}`, http.StatusConflict)
	var started, delivered, cancelled int
	var auditJSON string
	if err := f.pool.QueryRow(t.Context(), `SELECT
		count(*) FILTER(WHERE action='session.started' AND object_id=$1 AND actor_id=$3),
		count(*) FILTER(WHERE action='session.completed' AND object_id=$1 AND actor_id=$3),
		count(*) FILTER(WHERE action='session.cancelled' AND object_id=$2 AND actor_id=$4),
		COALESCE(json_agg(a)::text,'[]') FROM audit_events a WHERE action IN ('session.started','session.completed','session.cancelled')`, f.booked[0].ID, f.booked[1].ID, f.assigned.id, f.actor).Scan(&started, &delivered, &cancelled, &auditJSON); err != nil {
		t.Fatal(err)
	}
	if started != 1 || delivered != 1 || cancelled != 1 || strings.Contains(auditJSON, observation) {
		t.Fatal("delivery audits have incorrect actor/object/count or contain observation text")
	}
}
