//go:build integration

package inventory_test

import (
	"errors"
	"testing"
	"time"

	"ayurflow/backend/internal/inventory"
	"ayurflow/backend/internal/testutil"
	"github.com/jackc/pgx/v5/pgconn"
)

func TestQA04InventoryAuditFailureRollsBack(t *testing.T) {
	pool := testutil.Postgres(t)
	service := inventory.NewService(pool)
	dispensary := seedStaff(t, pool, "qa04-stock", "dispensary")
	reception := seedStaff(t, pool, "qa04-stock-reception", "receptionist")
	therapist := seedStaff(t, pool, "qa04-stock-therapist", "therapist")
	patient, session := syntheticSession(t, pool, reception, therapist)
	item, err := service.CreateItem(t.Context(), dispensary, inventory.CreateItemRequest{Code: "QA04-ITEM", DisplayName: "Synthetic audit botanical"})
	if err != nil {
		t.Fatal(err)
	}
	expiry := time.Now().UTC().AddDate(1, 0, 0).Format("2006-01-02")
	batch, err := service.ReceiveBatch(t.Context(), dispensary, inventory.ReceiveBatchRequest{ItemID: item.ID, BatchReference: "QA04-LOT", ReceivedGrams: "20.000", ExpiresAt: &expiry})
	if err != nil {
		t.Fatal(err)
	}
	recipeRequest := inventory.RecipeRequest{Code: "QA04-RECIPE", DisplayName: "Synthetic audit recipe", BaseYieldGrams: "10.000", Ingredients: []inventory.RecipeIngredientInput{{ItemID: item.ID, QuantityGrams: "10.000"}}}
	recipe, err := service.CreateRecipe(t.Context(), dispensary, recipeRequest)
	if err != nil {
		t.Fatal(err)
	}
	preparationRequest := inventory.SavePreparationRequest{PatientID: patient, SessionID: session, RecipeID: recipe.ID, TargetYieldGrams: "10.000"}
	preparation, err := service.SavePreparation(t.Context(), dispensary, preparationRequest)
	if err != nil {
		t.Fatal(err)
	}
	var operation string
	if err := pool.QueryRow(t.Context(), `SELECT gen_random_uuid()::text`).Scan(&operation); err != nil {
		t.Fatal(err)
	}
	snapshot := func() string {
		t.Helper()
		var value string
		if err := pool.QueryRow(t.Context(), `SELECT json_build_array(
			(SELECT json_agg(x ORDER BY id) FROM botanical_items x),
			(SELECT json_agg(x ORDER BY id) FROM stock_batches x),
			(SELECT json_agg(x ORDER BY id) FROM recipes x),
			(SELECT json_agg(x ORDER BY recipe_id,item_id) FROM recipe_ingredients x),
			(SELECT json_agg(x ORDER BY id) FROM preparations x),
			(SELECT json_agg(x ORDER BY preparation_id,item_id) FROM preparation_snapshot_items x),
			(SELECT json_agg(x ORDER BY preparation_id,batch_id) FROM batch_consumptions x),
			(SELECT json_agg(x ORDER BY operation_id) FROM consumption_operations x),
			(SELECT json_agg(x ORDER BY id) FROM audit_events x))::text`).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	before := snapshot()
	if _, err := pool.Exec(t.Context(), `CREATE FUNCTION qa04_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN RAISE EXCEPTION 'synthetic forced audit failure'; END; $$;
		CREATE TRIGGER qa04_reject BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION qa04_reject_audit()`); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		mutate func() error
	}{
		{"deactivate", func() error {
			_, err := service.DeactivateItem(t.Context(), dispensary, item.ID, inventory.DeactivateItemRequest{Reason: "Synthetic failed deactivation"})
			return err
		}},
		{"receive", func() error {
			_, err := service.ReceiveBatch(t.Context(), dispensary, inventory.ReceiveBatchRequest{ItemID: item.ID, BatchReference: "QA04-FAILED-LOT", ReceivedGrams: "5.000", ExpiresAt: &expiry})
			return err
		}},
		{"block", func() error {
			_, err := service.BlockBatch(t.Context(), dispensary, batch.ID, inventory.BlockBatchRequest{Reason: "Synthetic failed block"})
			return err
		}},
		{"create recipe", func() error {
			request := recipeRequest
			request.Code = "QA04-FAILED-RECIPE"
			_, err := service.CreateRecipe(t.Context(), dispensary, request)
			return err
		}},
		{"update recipe", func() error {
			request := recipeRequest
			request.Version = recipe.Version
			request.DisplayName = "Synthetic failed update"
			_, err := service.UpdateRecipe(t.Context(), dispensary, recipe.ID, request)
			return err
		}},
		{"consume", func() error {
			_, _, err := service.ConfirmConsumption(t.Context(), dispensary, preparation.ID, inventory.ConfirmConsumptionRequest{OperationID: operation, Allocations: []inventory.Allocation{{BatchID: batch.ID, QuantityGrams: "10.000"}}})
			return err
		}},
		{"save preparation", func() error {
			_, err := service.SavePreparation(t.Context(), dispensary, preparationRequest)
			return err
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var failure *pgconn.PgError
			if err := tc.mutate(); !errors.As(err, &failure) || failure.Code != "P0001" {
				t.Fatalf("mutation did not reach failing audit trigger: %v", err)
			}
			if after := snapshot(); after != before {
				t.Fatal("failed audit changed committed stock, preparation, operation or audit records")
			}
		})
	}
}
