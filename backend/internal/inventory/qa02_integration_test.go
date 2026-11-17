//go:build integration

package inventory_test

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"ayurflow/backend/internal/inventory"
	"ayurflow/backend/internal/testutil"
)

func TestQA02TraceReportAccessAndProjection(t *testing.T) {
	pool := testutil.Postgres(t)
	svc := inventory.NewService(pool)
	dispenser := seedStaff(t, pool, "qa02-dispensary", "dispensary")
	reception := seedStaff(t, pool, "qa02-reception", "receptionist")
	reader := seedStaff(t, pool, "qa02-reader", "report_reader")
	clinician := seedStaff(t, pool, "qa02-clinician", "clinician")
	unassigned := seedStaff(t, pool, "qa02-unassigned", "clinician")
	var patients, batches []string
	for i, suffix := range []string{"A", "B"} {
		therapist := seedStaff(t, pool, "qa02-therapist-"+suffix, "therapist")
		patient, session := syntheticSession(t, pool, reception, therapist)
		// The existing fixture uses a fixed room code; keep each patient's room distinct.
		if _, err := pool.Exec(t.Context(), "UPDATE clinic_rooms SET code=$1 WHERE code='SYN-PREP-ROOM'", "QA02-ROOM-"+suffix); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(t.Context(), "UPDATE patients SET address='Synthetic hidden-address-canary' WHERE id=$1", patient); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(t.Context(), "UPDATE therapy_sessions SET observations='Synthetic hidden-observation-canary' WHERE id=$1", session); err != nil {
			t.Fatal(err)
		}
		item, err := svc.CreateItem(t.Context(), dispenser, inventory.CreateItemRequest{Code: "QA02-" + suffix, DisplayName: "Synthetic report item " + suffix})
		if err != nil {
			t.Fatal(err)
		}
		expiry := "2099-01-01"
		batch, err := svc.ReceiveBatch(t.Context(), dispenser, inventory.ReceiveBatchRequest{ItemID: item.ID, BatchReference: "QA02-LOT-" + suffix, ReceivedGrams: "10.000", ExpiresAt: &expiry})
		if err != nil {
			t.Fatal(err)
		}
		recipe, err := svc.CreateRecipe(t.Context(), dispenser, inventory.RecipeRequest{Code: "QA02-RECIPE-" + suffix, DisplayName: "Synthetic report recipe", BaseYieldGrams: "10.000", Ingredients: []inventory.RecipeIngredientInput{{ItemID: item.ID, QuantityGrams: "1.000"}}})
		if err != nil {
			t.Fatal(err)
		}
		prep, err := svc.SavePreparation(t.Context(), dispenser, inventory.SavePreparationRequest{PatientID: patient, SessionID: session, RecipeID: recipe.ID, TargetYieldGrams: "10.000"})
		if err != nil {
			t.Fatal(err)
		}
		before, err := svc.TraceBatch(t.Context(), reader, batch.ID)
		if err != nil || len(before) != 0 {
			t.Fatal("unconsumed preparation appeared in report")
		}
		op := []string{"8a111111-1111-4111-8111-111111111111", "8a222222-2222-4222-8222-222222222222"}[i]
		if _, _, err := svc.ConfirmConsumption(t.Context(), dispenser, prep.ID, inventory.ConfirmConsumptionRequest{OperationID: op, Allocations: []inventory.Allocation{{BatchID: batch.ID, QuantityGrams: "1.000"}}}); err != nil {
			t.Fatal(err)
		}
		patients = append(patients, patient)
		batches = append(batches, batch.ID)
	}
	if _, err := pool.Exec(t.Context(), "INSERT INTO patient_clinician_assignments(patient_id,clinician_id,granted_by) VALUES ($1,$2,$3)", patients[0], clinician, reception); err != nil {
		t.Fatal(err)
	}
	for _, actor := range []string{reader, dispenser} {
		for i := range patients {
			forward, err := svc.TraceBatch(t.Context(), actor, batches[i])
			if err != nil || len(forward) != 1 || forward[0].PatientID != patients[i] || forward[0].BatchID != batches[i] {
				t.Fatal("batch report crossed its record filter")
			}
			reverse, err := svc.TracePatient(t.Context(), actor, patients[i])
			if err != nil || len(reverse) != 1 || reverse[0].PatientID != patients[i] || reverse[0].BatchID != batches[i] {
				t.Fatal("patient report crossed its record filter")
			}
			encoded, err := json.Marshal(reverse)
			if err != nil {
				t.Fatal(err)
			}
			if strings.Contains(string(encoded), "hidden-") {
				t.Fatal("report disclosed private fixture text")
			}
			var fields []map[string]any
			if err := json.Unmarshal(encoded, &fields); err != nil {
				t.Fatal(err)
			}
			allowed := map[string]bool{"patientId": true, "patientDisplayName": true, "sessionId": true, "preparationId": true, "batchId": true, "batchReference": true, "quantityGrams": true, "confirmedBy": true, "confirmedAt": true}
			if len(fields[0]) != len(allowed) {
				t.Fatal("unexpected trace report fields")
			}
			for key := range fields[0] {
				if !allowed[key] {
					t.Fatalf("unexpected trace field %q", key)
				}
			}
		}
	}
	if rows, err := svc.TracePatient(t.Context(), clinician, patients[0]); err != nil || len(rows) != 1 {
		t.Fatal("assigned clinician could not read patient trace")
	}
	for _, actor := range []string{clinician, unassigned} {
		if _, err := svc.TracePatient(t.Context(), actor, patients[1]); !errors.Is(err, inventory.ErrForbidden) {
			t.Fatal("unassigned clinician read patient trace")
		}
		if _, err := svc.TraceBatch(t.Context(), actor, batches[0]); !errors.Is(err, inventory.ErrForbidden) {
			t.Fatal("clinician entered global batch trace")
		}
	}
	for _, role := range []string{"administrator", "receptionist", "therapist", "billing"} {
		actor := seedStaff(t, pool, "qa02-denied-"+role, role)
		if _, err := svc.TracePatient(t.Context(), actor, patients[0]); !errors.Is(err, inventory.ErrForbidden) {
			t.Fatalf("%s read patient trace", role)
		}
		if _, err := svc.TraceBatch(t.Context(), actor, batches[0]); !errors.Is(err, inventory.ErrForbidden) {
			t.Fatalf("%s read batch trace", role)
		}
	}
	if _, err := pool.Exec(t.Context(), "UPDATE patient_clinician_assignments SET revoked_at=clock_timestamp(),revoked_by=$2 WHERE patient_id=$1", patients[0], reception); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.TracePatient(t.Context(), clinician, patients[0]); !errors.Is(err, inventory.ErrForbidden) {
		t.Fatal("revoked assignment retained trace access")
	}
	if _, err := pool.Exec(t.Context(), "UPDATE staff_accounts SET active=false WHERE id=$1", reader); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.TraceBatch(t.Context(), reader, batches[0]); !errors.Is(err, inventory.ErrForbidden) {
		t.Fatal("disabled reader retained access")
	}
}

func TestQA02StockReportFiltersAndReadOnlyRole(t *testing.T) {
	pool := testutil.Postgres(t)
	svc := inventory.NewService(pool).WithClock(func() time.Time { return time.Date(2026, 11, 17, 8, 0, 0, 0, time.UTC) })
	dispenser := seedStaff(t, pool, "qa02-stock-dispensary", "dispensary")
	reader := seedStaff(t, pool, "qa02-stock-reader", "report_reader")
	item, err := svc.CreateItem(t.Context(), dispenser, inventory.CreateItemRequest{Code: "QA02-STOCK", DisplayName: "Synthetic filtered item"})
	if err != nil {
		t.Fatal(err)
	}
	other, err := svc.CreateItem(t.Context(), dispenser, inventory.CreateItemRequest{Code: "QA02-OTHER", DisplayName: "Synthetic excluded item"})
	if err != nil {
		t.Fatal(err)
	}
	good, expired := "2099-01-01", "2000-01-01"
	var eligible string
	for i, expiry := range []*string{&good, &good, &expired, nil} {
		batch, err := svc.ReceiveBatch(t.Context(), dispenser, inventory.ReceiveBatchRequest{ItemID: item.ID, BatchReference: []string{"QA02-ELIGIBLE", "QA02-BLOCKED", "QA02-EXPIRED", "QA02-UNKNOWN"}[i], ReceivedGrams: "10.000", ExpiresAt: expiry})
		if err != nil {
			t.Fatal(err)
		}
		if i == 0 {
			eligible = batch.ID
		}
		if i == 1 {
			if _, err := svc.BlockBatch(t.Context(), dispenser, batch.ID, inventory.BlockBatchRequest{Reason: "Synthetic blocked"}); err != nil {
				t.Fatal(err)
			}
		}
	}
	if _, err := svc.ReceiveBatch(t.Context(), dispenser, inventory.ReceiveBatchRequest{ItemID: other.ID, BatchReference: "QA02-OTHER-LOT", ReceivedGrams: "99.000", ExpiresAt: &good}); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	cursor := ""
	for page := 0; page < 5; page++ {
		result, err := svc.ListBatches(t.Context(), reader, inventory.ListBatchesFilter{ItemID: item.ID, Limit: 1, Cursor: cursor})
		if err != nil || len(result.Items) != 1 {
			t.Fatal("stock pagination failed")
		}
		row := result.Items[0]
		if row.ItemID != item.ID || seen[row.ID] {
			t.Fatal("stock filter/pagination leaked or repeated a batch")
		}
		seen[row.ID] = true
		if result.NextCursor == nil {
			break
		}
		cursor = *result.NextCursor
	}
	if len(seen) != 4 {
		t.Fatal("stock pagination lost records")
	}
	result, err := svc.ListBatches(t.Context(), reader, inventory.ListBatchesFilter{ItemID: item.ID, EligibleOnly: true})
	if err != nil || len(result.Items) != 1 || result.Items[0].ID != eligible {
		t.Fatal("eligible filter returned another stock category")
	}
	if result.Summary.EligibleGrams != "10.000" || result.Summary.BlockedGrams != "10.000" || result.Summary.ExpiredGrams != "10.000" || result.Summary.UnknownExpiryGrams != "10.000" {
		t.Fatal("item summary included unrelated stock")
	}
	if _, err := svc.BlockBatch(t.Context(), reader, eligible, inventory.BlockBatchRequest{Reason: "Denied reader write"}); !errors.Is(err, inventory.ErrForbidden) {
		t.Fatal("reader changed stock")
	}
	unchanged, err := svc.ListBatches(t.Context(), reader, inventory.ListBatchesFilter{ItemID: item.ID, EligibleOnly: true})
	if err != nil || len(unchanged.Items) != 1 || unchanged.Items[0].RemainingGrams != "10.000" {
		t.Fatal("denied write changed stock")
	}
}
