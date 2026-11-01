//go:build integration

package http

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"ayurflow/backend/internal/auth"
	"ayurflow/backend/internal/consultations"
)

// These tests exercise the protected HTTP boundary as well as PostgreSQL's
// conflict and rollback behavior with synthetic records.
func TestAT02DuplicateIdentityHTTPIntegration(t *testing.T) {
	f := newProtectedFixture(t)
	path := "/api/v1/patients"
	bodies := []string{
		`{"displayName":"Synthetic race one","birthDate":"1990-04-12","gender":"UNDISCLOSED","phone":"0770000101","identity":{"type":"NIC","value":"1999 12345678 V"}}`,
		`{"displayName":"Synthetic race two","birthDate":"1990-04-12","gender":"UNDISCLOSED","phone":"0770000102","identity":{"type":"NIC","value":"1999-12345678v"}}`,
	}
	start := make(chan struct{})
	results := make(chan int, 2)
	for _, body := range bodies {
		go func() {
			<-start
			response := protectedRequest(f.router, http.MethodPost, path, f.token, f.csrf, body)
			if response.Code == http.StatusConflict &&
				(strings.Contains(response.Body.String(), "Synthetic race") || strings.Contains(response.Body.String(), "AYUR-PT")) {
				results <- 0 // A conflict must not reveal the winning patient.
				return
			}
			results <- response.Code
		}()
	}
	close(start)
	first, second := <-results, <-results
	if !((first == http.StatusCreated && second == http.StatusConflict) ||
		(first == http.StatusConflict && second == http.StatusCreated)) {
		t.Fatalf("duplicate registration results=%d,%d; want 201 and 409", first, second)
	}
	var patients, identities, audits int
	err := f.pool.QueryRow(t.Context(), `SELECT
		(SELECT count(*) FROM patients),
		(SELECT count(*) FROM patient_identities),
		(SELECT count(*) FROM audit_events WHERE action='patient.created')`).Scan(&patients, &identities, &audits)
	if err != nil || patients != 1 || identities != 1 || audits != 1 {
		t.Fatalf("losing registration committed data: patients=%d identities=%d audits=%d err=%v",
			patients, identities, audits, err)
	}
}

func TestAT03SignEditHTTPRaceIntegration(t *testing.T) {
	f := newProtectedFixture(t)
	patient := createProtectedPatient(t, f)
	password := "synthetic-clinician-race-password"
	hash, err := auth.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	var clinician string
	if err := f.pool.QueryRow(t.Context(), `INSERT INTO staff_accounts(login_identifier,password_hash)
		VALUES('synthetic-clinician-race',$1) RETURNING id::text`, hash).Scan(&clinician); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO staff_roles(staff_id,role_code)
		VALUES($1,'clinician')`, clinician); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO staff_roles(staff_id,role_code)
		VALUES($1,'administrator')`, f.actor); err != nil {
		t.Fatal(err)
	}
	assignmentPath := "/api/v1/patients/" + patient.ID + "/clinical-assignments"
	response := protectedRequest(f.router, http.MethodPost, assignmentPath, f.token, f.csrf,
		`{"clinicianId":"`+clinician+`"}`)
	if response.Code != http.StatusCreated {
		t.Fatalf("assignment status=%d body=%s", response.Code, response.Body.String())
	}
	session, token, err := f.sessions.Login(t.Context(), "synthetic-clinician-race", password, "")
	if err != nil {
		t.Fatal(err)
	}
	response = protectedRequest(f.router, http.MethodPost, "/api/v1/patients/"+patient.ID+"/consultations",
		token, session.CSRFToken, `{"draftText":"Synthetic original draft"}`)
	if response.Code != http.StatusCreated {
		t.Fatalf("draft status=%d body=%s", response.Code, response.Body.String())
	}
	var draft consultations.Consultation
	if err := json.Unmarshal(response.Body.Bytes(), &draft); err != nil {
		t.Fatal(err)
	}
	path := "/api/v1/consultations/" + draft.ID
	start := make(chan struct{})
	results := make(chan int, 2)
	for _, request := range []struct{ method, path, body string }{
		{http.MethodPatch, path, `{"version":1,"draftText":"Synthetic raced edit"}`},
		{http.MethodPost, path + "/sign", `{"version":1}`},
	} {
		go func() {
			<-start
			response := protectedRequest(f.router, request.method, request.path, token, session.CSRFToken, request.body)
			results <- response.Code
		}()
	}
	close(start)
	first, second := <-results, <-results
	if !((first == http.StatusOK && second == http.StatusConflict) ||
		(first == http.StatusConflict && second == http.StatusOK)) {
		t.Fatalf("sign/edit results=%d,%d; want 200 and 409", first, second)
	}
	response = protectedRequest(f.router, http.MethodGet, path, token, "", "")
	if response.Code != http.StatusOK {
		t.Fatalf("detail status=%d body=%s", response.Code, response.Body.String())
	}
	var final consultations.Consultation
	if err := json.Unmarshal(response.Body.Bytes(), &final); err != nil {
		t.Fatal(err)
	}
	if final.Version != 2 ||
		!(final.Status == "signed" && final.SignedText == "Synthetic original draft" ||
			final.Status == "draft" && final.DraftText == "Synthetic raced edit") {
		t.Fatalf("race left an incoherent consultation: %+v", final)
	}
	var events int
	if err := f.pool.QueryRow(t.Context(), `SELECT count(*) FROM audit_events
		WHERE object_type='consultation' AND object_id=$1`, draft.ID).Scan(&events); err != nil || events != 2 {
		t.Fatalf("race audit events=%d err=%v", events, err)
	}
}
