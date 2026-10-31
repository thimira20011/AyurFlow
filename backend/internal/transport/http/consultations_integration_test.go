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

func TestProtectedConsultationDraftFlowIntegration(t *testing.T) {
	f := newProtectedFixture(t)
	patient := createProtectedPatient(t, f)
	password := "synthetic-clinician-password"
	hash, err := auth.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	var clinician string
	if err := f.pool.QueryRow(t.Context(), `INSERT INTO staff_accounts(login_identifier,password_hash)
		VALUES('synthetic-http-clinician',$1) RETURNING id::text`, hash).Scan(&clinician); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO staff_roles(staff_id,role_code)
		VALUES($1,'clinician')`, clinician); err != nil {
		t.Fatal(err)
	}
	session, token, err := f.sessions.Login(t.Context(), "synthetic-http-clinician", password, "")
	if err != nil {
		t.Fatal(err)
	}
	listPath := "/api/v1/patients/" + patient.ID + "/consultations"
	if response := protectedRequest(f.router, "GET", listPath, token, "", ""); response.Code != http.StatusNotFound {
		t.Fatalf("unassigned list status=%d", response.Code)
	}
	if response := protectedRequest(f.router, "POST", listPath, token, session.CSRFToken,
		`{"draftText":"Denied before assignment"}`); response.Code != http.StatusNotFound {
		t.Fatalf("unassigned create status=%d", response.Code)
	}
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO patient_clinician_assignments(patient_id,clinician_id,granted_by)
		VALUES ($1,$2,$3)`, patient.ID, clinician, f.actor); err != nil {
		t.Fatal(err)
	}
	if response := protectedRequest(f.router, "POST", listPath, token, "",
		`{"draftText":"CSRF denied"}`); response.Code != http.StatusForbidden {
		t.Fatalf("missing CSRF status=%d", response.Code)
	}
	if response := protectedRequest(f.router, "POST", listPath, token, session.CSRFToken,
		`{"draftText":"bad","actorId":"forged"}`); response.Code != http.StatusBadRequest {
		t.Fatalf("unknown field status=%d", response.Code)
	}
	response := protectedRequest(f.router, "POST", listPath, token, session.CSRFToken,
		`{"draftText":"Synthetic සිංහල consultation"}`)
	if response.Code != http.StatusCreated {
		t.Fatalf("create status=%d body=%s", response.Code, response.Body.String())
	}
	var record consultations.Consultation
	if err := json.Unmarshal(response.Body.Bytes(), &record); err != nil {
		t.Fatal(err)
	}
	if record.CreatedBy != clinician || record.Status != "draft" {
		t.Fatalf("wrong consultation actor/status: %+v", record)
	}
	response = protectedRequest(f.router, "GET", listPath, token, "", "")
	if response.Code != http.StatusOK || strings.Contains(response.Body.String(), "සිංහල") || !strings.Contains(response.Body.String(), record.ID) {
		t.Fatalf("list leaked clinical text or hid entry: %d %s", response.Code, response.Body.String())
	}
	detailPath := "/api/v1/consultations/" + record.ID
	response = protectedRequest(f.router, "GET", detailPath, token, "", "")
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "සිංහල") {
		t.Fatalf("assigned detail status=%d body=%s", response.Code, response.Body.String())
	}
	response = protectedRequest(f.router, "GET", detailPath, f.token, "", "")
	if response.Code != http.StatusNotFound || strings.Contains(response.Body.String(), "සිංහල") {
		t.Fatalf("reception note access status=%d", response.Code)
	}
	response = protectedRequest(f.router, "PATCH", detailPath, token, session.CSRFToken,
		`{"version":1,"draftText":"Synthetic edited draft"}`)
	if response.Code != http.StatusOK {
		t.Fatalf("edit status=%d body=%s", response.Code, response.Body.String())
	}
	response = protectedRequest(f.router, "PATCH", detailPath, token, session.CSRFToken,
		`{"version":1,"draftText":"Stale draft"}`)
	if response.Code != http.StatusConflict {
		t.Fatalf("stale edit status=%d", response.Code)
	}
	signPath := detailPath + "/sign"
	if response = protectedRequest(f.router, "POST", signPath, token, "", `{"version":2}`); response.Code != http.StatusForbidden {
		t.Fatalf("sign without CSRF status=%d", response.Code)
	}
	if response = protectedRequest(f.router, "POST", signPath, f.token, f.csrf, `{"version":2}`); response.Code != http.StatusNotFound {
		t.Fatalf("reception sign status=%d", response.Code)
	}
	response = protectedRequest(f.router, "POST", signPath, token, session.CSRFToken, `{"version":2}`)
	if response.Code != http.StatusOK {
		t.Fatalf("sign status=%d body=%s", response.Code, response.Body.String())
	}
	var signed consultations.Consultation
	if err := json.Unmarshal(response.Body.Bytes(), &signed); err != nil {
		t.Fatal(err)
	}
	if signed.Status != "signed" || signed.SignedText != "Synthetic edited draft" || signed.SignedBy != clinician || signed.SignedAt == nil {
		t.Fatalf("wrong signed record: %+v", signed)
	}
	if response = protectedRequest(f.router, "PATCH", detailPath, token, session.CSRFToken,
		`{"version":3,"draftText":"Changed after signing"}`); response.Code != http.StatusConflict {
		t.Fatalf("signed edit status=%d", response.Code)
	}
	if response = protectedRequest(f.router, "POST", signPath, token, session.CSRFToken,
		`{"version":2}`); response.Code != http.StatusConflict {
		t.Fatalf("repeat sign status=%d", response.Code)
	}
	addendaPath := detailPath + "/addenda"
	if response = protectedRequest(f.router, "POST", addendaPath, token, session.CSRFToken,
		`{"reason":" ","body":"Invalid"}`); response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid addendum status=%d", response.Code)
	}
	if response = protectedRequest(f.router, "POST", addendaPath, f.token, f.csrf,
		`{"reason":"Correction","body":"Denied"}`); response.Code != http.StatusNotFound {
		t.Fatalf("reception addendum status=%d", response.Code)
	}
	response = protectedRequest(f.router, "POST", addendaPath, token, session.CSRFToken,
		`{"reason":"Clarification","body":"Synthetic dated correction"}`)
	if response.Code != http.StatusCreated {
		t.Fatalf("addendum status=%d body=%s", response.Code, response.Body.String())
	}
	var added consultations.Addendum
	if err := json.Unmarshal(response.Body.Bytes(), &added); err != nil {
		t.Fatal(err)
	}
	if added.AuthorID != clinician || added.Reason != "Clarification" || added.CreatedAt.IsZero() {
		t.Fatalf("wrong addendum: %+v", added)
	}
	response = protectedRequest(f.router, "GET", detailPath, token, "", "")
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "Synthetic dated correction") ||
		!strings.Contains(response.Body.String(), "Synthetic edited draft") {
		t.Fatalf("signed detail status=%d body=%s", response.Code, response.Body.String())
	}
	if _, err := f.pool.Exec(t.Context(), `UPDATE patient_clinician_assignments
		SET revoked_at=clock_timestamp(), revoked_by=$2 WHERE patient_id=$1 AND clinician_id=$2`, patient.ID, clinician); err != nil {
		t.Fatal(err)
	}
	response = protectedRequest(f.router, "GET", detailPath, token, "", "")
	if response.Code != http.StatusNotFound {
		t.Fatalf("revoked detail status=%d", response.Code)
	}
	if response = protectedRequest(f.router, "POST", addendaPath, token, session.CSRFToken,
		`{"reason":"After revocation","body":"Denied"}`); response.Code != http.StatusNotFound {
		t.Fatalf("revoked addendum status=%d", response.Code)
	}
}
