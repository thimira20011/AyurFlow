//go:build integration

package http

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"ayurflow/backend/internal/auth"
	"ayurflow/backend/internal/clinical"
	"ayurflow/backend/internal/consultations"
)

func TestProtectedPlanPathwayIntegration(t *testing.T) {
	f := newProtectedFixture(t)
	patient := createProtectedPatient(t, f)
	password := "synthetic-plan-http-password"
	hash, err := auth.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	var clinician string
	if err := f.pool.QueryRow(t.Context(), `INSERT INTO staff_accounts(login_identifier,password_hash)
		VALUES('synthetic-plan-http-clinician',$1) RETURNING id::text`, hash).Scan(&clinician); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO staff_roles(staff_id,role_code)
		VALUES($1,'clinician'),($2,'administrator')`, clinician, f.actor); err != nil {
		t.Fatal(err)
	}
	assignmentPath := "/api/v1/patients/" + patient.ID + "/clinical-assignments"
	if response := protectedRequest(f.router, http.MethodPost, assignmentPath, f.token, f.csrf,
		`{"clinicianId":"`+clinician+`"}`); response.Code != http.StatusCreated {
		t.Fatalf("assignment status=%d body=%s", response.Code, response.Body.String())
	}
	session, token, err := f.sessions.Login(t.Context(), "synthetic-plan-http-clinician", password, "")
	if err != nil {
		t.Fatal(err)
	}
	f.router = NewRouter(f.pool, AuthRoutes{Service: f.sessions, AllowedOrigin: protectedOrigin,
		Patients: nil, Consultations: consultations.NewService(f.pool, consultations.AssignedPolicy{}),
		Signing: consultations.NewService(f.pool, consultations.AssignedPolicy{}),
		Plans:   clinical.NewService(f.pool, clinical.MemberBPathway(), nil)})
	listPath := "/api/v1/patients/" + patient.ID + "/plans"
	if response := protectedRequest(f.router, http.MethodPost, listPath, f.token, f.csrf, `{}`); response.Code != 404 {
		t.Fatalf("reception created plan: %d", response.Code)
	}
	if response := protectedRequest(f.router, http.MethodPost, listPath, token, "", `{}`); response.Code != 403 {
		t.Fatalf("plan create without CSRF: %d", response.Code)
	}
	response := protectedRequest(f.router, http.MethodPost, listPath, token, session.CSRFToken, `{}`)
	if response.Code != http.StatusCreated {
		t.Fatalf("create plan status=%d body=%s", response.Code, response.Body.String())
	}
	var plan clinical.Plan
	if err := json.Unmarshal(response.Body.Bytes(), &plan); err != nil {
		t.Fatal(err)
	}
	if plan.PathwayState != "PREPARATORY" || plan.CurrentOrdinal != 1 {
		t.Fatalf("wrong pathway entry: %+v", plan)
	}
	planPath := "/api/v1/plans/" + plan.ID
	if response := protectedRequest(f.router, http.MethodGet, planPath, f.token, "", ""); response.Code != 404 {
		t.Fatalf("reception read clinical plan: %d", response.Code)
	}
	response = protectedRequest(f.router, http.MethodGet, planPath, token, "", "")
	if response.Code != 200 {
		t.Fatalf("plan detail status=%d body=%s", response.Code, response.Body.String())
	}
	var detail clinical.Detail
	if err := json.Unmarshal(response.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if len(detail.Stages) != 3 || detail.Stages[2].Code != "RECOVERY" {
		t.Fatalf("wrong stage snapshots: %+v", detail.Stages)
	}
	futurePath := planPath + "/stages/" + detail.Stages[1].ID + "/approve"
	if response := protectedRequest(f.router, http.MethodPost, futurePath, token, session.CSRFToken,
		`{"version":1,"confirmedChecks":["All scheduled primary therapy sessions completed","Botanical preparations confirmed or accounted for","Attending clinician interim evaluation approval"]}`); response.Code != 409 {
		t.Fatalf("future stage approved: %d", response.Code)
	}
	firstPath := planPath + "/stages/" + detail.Stages[0].ID + "/approve"
	checks, _ := json.Marshal(struct {
		Version         int64    `json:"version"`
		ConfirmedChecks []string `json:"confirmedChecks"`
	}{Version: 1, ConfirmedChecks: detail.Stages[0].RequiredChecks})
	if response := protectedRequest(f.router, http.MethodPost, firstPath, token, session.CSRFToken,
		string(checks)); response.Code != 409 {
		t.Fatalf("unsigned consultation allowed approval: %d", response.Code)
	}
	draftResponse := protectedRequest(f.router, http.MethodPost, "/api/v1/patients/"+patient.ID+"/consultations",
		token, session.CSRFToken, `{"draftText":"Synthetic pre-treatment assessment"}`)
	if draftResponse.Code != 201 {
		t.Fatalf("draft status=%d", draftResponse.Code)
	}
	var draft consultations.Consultation
	if err := json.Unmarshal(draftResponse.Body.Bytes(), &draft); err != nil {
		t.Fatal(err)
	}
	if response := protectedRequest(f.router, http.MethodPost, "/api/v1/consultations/"+draft.ID+"/sign",
		token, session.CSRFToken, `{"version":1}`); response.Code != 200 {
		t.Fatalf("sign status=%d", response.Code)
	}
	if response := protectedRequest(f.router, http.MethodPost, firstPath, token, session.CSRFToken,
		string(checks)); response.Code != 200 {
		t.Fatalf("first stage approval status=%d body=%s", response.Code, response.Body.String())
	}
	if response := protectedRequest(f.router, http.MethodPost, planPath+"/advance", token, session.CSRFToken,
		`{"version":2}`); response.Code != 409 {
		t.Fatalf("missing C completion evidence advanced: %d", response.Code)
	}
	response = protectedRequest(f.router, http.MethodPost, planPath+"/hold", token, session.CSRFToken,
		`{"version":2,"reason":"Synthetic clinical pause"}`)
	if response.Code != 200 || !strings.Contains(response.Body.String(), `"status":"held"`) {
		t.Fatalf("hold status=%d body=%s", response.Code, response.Body.String())
	}
	if response := protectedRequest(f.router, http.MethodPost, planPath+"/resume", token, session.CSRFToken,
		`{"version":3,"reason":"Synthetic reassessment"}`); response.Code != 200 {
		t.Fatalf("resume status=%d body=%s", response.Code, response.Body.String())
	}
	if response := protectedRequest(f.router, http.MethodPost, planPath+"/cancel", token, session.CSRFToken,
		`{"version":4,"reason":"Synthetic cancellation"}`); response.Code != 409 {
		t.Fatalf("missing C cancellation hook cancelled plan: %d", response.Code)
	}
}
