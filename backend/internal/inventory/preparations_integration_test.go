//go:build integration

package inventory_test

import (
	"errors"
	"sync"
	"testing"
	"time"

	"ayurflow/backend/internal/inventory"
	"ayurflow/backend/internal/scheduling"
	"ayurflow/backend/internal/testutil"

	"github.com/jackc/pgx/v5/pgxpool"
)

func syntheticSession(t *testing.T, pool *pgxpool.Pool, reception, therapist string) (string, string) {
	t.Helper()
	var patient, plan, stage, room, session string
	if err := pool.QueryRow(t.Context(), `INSERT INTO patients(display_name,created_by,updated_by)
		VALUES ('Synthetic botanical patient',$1,$1) RETURNING id::text`, reception).Scan(&patient); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(t.Context(), `INSERT INTO care_plans(patient_id,created_by,updated_by)
		VALUES ($1,$2,$2) RETURNING id::text`, patient, reception).Scan(&plan); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(t.Context(), `INSERT INTO plan_stages(plan_id,ordinal,label)
		VALUES ($1,1,'Synthetic preparatory') RETURNING id::text`, plan).Scan(&stage); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(), `UPDATE plan_stages SET status='approved',approved_by=$2,approved_at=clock_timestamp() WHERE id=$1`, stage, reception); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(), `UPDATE care_plans SET status='active',current_stage_ordinal=1 WHERE id=$1`, plan); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(t.Context(), `INSERT INTO clinic_rooms(code,name,created_by)
		VALUES ('SYN-PREP-ROOM','Synthetic preparation room',$1) RETURNING id::text`, reception).Scan(&room); err != nil {
		t.Fatal(err)
	}
	start := time.Now().UTC().Add(time.Hour)
	if err := pool.QueryRow(t.Context(), `INSERT INTO therapy_sessions(patient_id,plan_id,stage_id,room_id,therapist_id,starts_at,ends_at,created_by,updated_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id::text`, patient, plan, stage, room, therapist, start, start.Add(time.Hour), reception).Scan(&session); err != nil {
		t.Fatal(err)
	}
	if _, err := scheduling.NewService(pool).Start(t.Context(), therapist, session); err != nil {
		t.Fatal(err)
	}
	return patient, session
}

func TestAT09To11PreparationAndConsumption(t *testing.T) {
	pool := testutil.Postgres(t)
	svc := inventory.NewService(pool)
	dispensary := seedStaff(t, pool, "synthetic-preparation-dispensary", "dispensary")
	reception := seedStaff(t, pool, "synthetic-preparation-reception", "receptionist")
	therapist := seedStaff(t, pool, "synthetic-preparation-therapist", "therapist")
	patient, session := syntheticSession(t, pool, reception, therapist)
	itemA, err := svc.CreateItem(t.Context(), dispensary, inventory.CreateItemRequest{Code: "PREP-ASHWA", DisplayName: "Synthetic Ashwagandha"})
	if err != nil {
		t.Fatal(err)
	}
	itemB, err := svc.CreateItem(t.Context(), dispensary, inventory.CreateItemRequest{Code: "PREP-GUDU", DisplayName: "Synthetic Guduchi"})
	if err != nil {
		t.Fatal(err)
	}
	expiry := time.Now().UTC().AddDate(1, 0, 0).Format("2006-01-02")
	batchA, err := svc.ReceiveBatch(t.Context(), dispensary, inventory.ReceiveBatchRequest{ItemID: itemA.ID, BatchReference: "PREP-LOT-A", ReceivedGrams: "50.000", ExpiresAt: &expiry})
	if err != nil {
		t.Fatal(err)
	}
	batchB, err := svc.ReceiveBatch(t.Context(), dispensary, inventory.ReceiveBatchRequest{ItemID: itemB.ID, BatchReference: "PREP-LOT-B", ReceivedGrams: "37.500", ExpiresAt: &expiry})
	if err != nil {
		t.Fatal(err)
	}
	recipe, err := svc.CreateRecipe(t.Context(), dispensary, inventory.RecipeRequest{Code: "PREP-RECIPE", DisplayName: "Synthetic two ingredient recipe", BaseYieldGrams: "100.000",
		Ingredients: []inventory.RecipeIngredientInput{{ItemID: itemA.ID, QuantityGrams: "20.000"}, {ItemID: itemB.ID, QuantityGrams: "15.000"}}})
	if err != nil {
		t.Fatal(err)
	}
	prep, err := svc.SavePreparation(t.Context(), dispensary, inventory.SavePreparationRequest{PatientID: patient, SessionID: session, RecipeID: recipe.ID, TargetYieldGrams: "250.000"})
	if err != nil {
		t.Fatal(err)
	}
	if prep.Status != "prepared" || len(prep.Snapshot) != 2 {
		t.Fatalf("saved snapshot: %+v", prep)
	}
	var remaining string
	if err := pool.QueryRow(t.Context(), `SELECT remaining_grams::text FROM stock_batches WHERE id=$1`, batchA.ID).Scan(&remaining); err != nil || remaining != "50.000" {
		t.Fatalf("save deducted stock: %s %v", remaining, err)
	}
	updated, err := svc.UpdateRecipe(t.Context(), dispensary, recipe.ID, inventory.RecipeRequest{Code: recipe.Code, DisplayName: "Synthetic changed recipe", BaseYieldGrams: "100.000", Version: recipe.Version,
		Ingredients: []inventory.RecipeIngredientInput{{ItemID: itemA.ID, QuantityGrams: "25.000"}}})
	if err != nil || updated.Version != 2 {
		t.Fatalf("update recipe: %+v %v", updated, err)
	}
	still, err := svc.GetPreparation(t.Context(), dispensary, prep.ID)
	if err != nil || len(still.Snapshot) != 2 {
		t.Fatalf("snapshot changed after recipe edit: %+v %v", still, err)
	}
	op := "7c4a1b9e-2001-4c9a-8a11-111111111111"
	if _, _, err := svc.ConfirmConsumption(t.Context(), dispensary, prep.ID, inventory.ConfirmConsumptionRequest{
		OperationID: "7c4a1b9e-2001-4c9a-8a11-111111111119",
		Allocations: []inventory.Allocation{{BatchID: batchA.ID, QuantityGrams: "50.000"}},
	}); !errors.Is(err, inventory.ErrValidation) {
		t.Fatalf("partial allocation accepted: %v", err)
	}
	if err := pool.QueryRow(t.Context(), `SELECT remaining_grams::text FROM stock_batches WHERE id=$1`, batchA.ID).Scan(&remaining); err != nil || remaining != "50.000" {
		t.Fatalf("partial allocation deducted stock: %s %v", remaining, err)
	}
	request := inventory.ConfirmConsumptionRequest{OperationID: op, Allocations: []inventory.Allocation{{BatchID: batchA.ID, QuantityGrams: "50.000"}, {BatchID: batchB.ID, QuantityGrams: "37.500"}}}
	confirmed, replay, err := svc.ConfirmConsumption(t.Context(), dispensary, prep.ID, request)
	if err != nil || replay || confirmed.Status != "consumed" || len(confirmed.Consumptions) != 2 {
		t.Fatalf("confirm: %+v %v replay=%v", confirmed, err, replay)
	}
	if err := pool.QueryRow(t.Context(), `SELECT remaining_grams::text FROM stock_batches WHERE id=$1`, batchA.ID).Scan(&remaining); err != nil || remaining != "0.000" {
		t.Fatalf("stock after confirm: %s %v", remaining, err)
	}
	_, replay, err = svc.ConfirmConsumption(t.Context(), dispensary, prep.ID, request)
	if err != nil || !replay {
		t.Fatalf("same-payload retry: %v replay=%v", err, replay)
	}
	request.Allocations[0].QuantityGrams = "49.000"
	if _, _, err := svc.ConfirmConsumption(t.Context(), dispensary, prep.ID, request); !errors.Is(err, inventory.ErrConflict) {
		t.Fatalf("changed operation payload: %v", err)
	}
	forward, err := svc.TraceBatch(t.Context(), dispensary, batchA.ID)
	if err != nil || len(forward) != 1 || forward[0].PatientID != patient {
		t.Fatalf("forward trace: %+v %v", forward, err)
	}
	reverse, err := svc.TracePatient(t.Context(), dispensary, patient)
	if err != nil || len(reverse) != 2 {
		t.Fatalf("reverse trace: %+v %v", reverse, err)
	}
	if _, err := svc.TracePatient(t.Context(), reception, patient); !errors.Is(err, inventory.ErrForbidden) {
		t.Fatalf("reception trace: %v", err)
	}
}

func TestConcurrentConsumptionCannotOverdrawBatch(t *testing.T) {
	pool := testutil.Postgres(t)
	svc := inventory.NewService(pool)
	dispensary := seedStaff(t, pool, "synthetic-race-dispensary", "dispensary")
	reception := seedStaff(t, pool, "synthetic-race-reception", "receptionist")
	therapist := seedStaff(t, pool, "synthetic-race-therapist", "therapist")
	patient, session := syntheticSession(t, pool, reception, therapist)
	item, err := svc.CreateItem(t.Context(), dispensary, inventory.CreateItemRequest{Code: "PREP-RACE", DisplayName: "Synthetic race item"})
	if err != nil {
		t.Fatal(err)
	}
	expiry := time.Now().UTC().AddDate(1, 0, 0).Format("2006-01-02")
	batch, err := svc.ReceiveBatch(t.Context(), dispensary, inventory.ReceiveBatchRequest{ItemID: item.ID, BatchReference: "PREP-RACE-LOT", ReceivedGrams: "10.000", ExpiresAt: &expiry})
	if err != nil {
		t.Fatal(err)
	}
	recipe, err := svc.CreateRecipe(t.Context(), dispensary, inventory.RecipeRequest{Code: "PREP-RACE-REC", DisplayName: "Synthetic race recipe", BaseYieldGrams: "10.000",
		Ingredients: []inventory.RecipeIngredientInput{{ItemID: item.ID, QuantityGrams: "10.000"}}})
	if err != nil {
		t.Fatal(err)
	}
	var preparations []inventory.Preparation
	for i := 0; i < 2; i++ {
		prep, err := svc.SavePreparation(t.Context(), dispensary, inventory.SavePreparationRequest{PatientID: patient, SessionID: session, RecipeID: recipe.ID, TargetYieldGrams: "10.000"})
		if err != nil {
			t.Fatal(err)
		}
		preparations = append(preparations, prep)
	}
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i, prep := range preparations {
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			_, _, err := svc.ConfirmConsumption(t.Context(), dispensary, id,
				inventory.ConfirmConsumptionRequest{OperationID: []string{"7c4a1b9e-2001-4c9a-8a11-111111111112", "7c4a1b9e-2001-4c9a-8a11-111111111113"}[i], Allocations: []inventory.Allocation{{BatchID: batch.ID, QuantityGrams: "10.000"}}})
			results <- err
		}(i, prep.ID)
	}
	wg.Wait()
	close(results)
	success, conflicts := 0, 0
	for err := range results {
		if err == nil {
			success++
		} else if errors.Is(err, inventory.ErrConflict) {
			conflicts++
		} else {
			t.Fatalf("race: %v", err)
		}
	}
	if success != 1 || conflicts != 1 {
		t.Fatalf("stock race: success=%d conflicts=%d", success, conflicts)
	}
}
