//go:build integration

package billing

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestQA04InvoiceAuditFailureRollsBack(t *testing.T) {
	service, pool := billingFixture(t)
	var patient string
	if err := pool.QueryRow(t.Context(), `INSERT INTO patients(display_name,created_by,updated_by)
		VALUES ('Synthetic invoice audit patient',$1,$1) RETURNING id::text`, billingTestActor).Scan(&patient); err != nil {
		t.Fatal(err)
	}
	invoice, err := service.CreateInvoice(t.Context(), billingTestActor, CreateInvoiceRequest{PatientID: patient})
	if err != nil {
		t.Fatal(err)
	}
	item, err := service.AddItem(t.Context(), billingTestActor, invoice.ID, AddItemRequest{Description: "Synthetic audit fee", Quantity: 1, UnitPriceMinor: 100})
	if err != nil {
		t.Fatal(err)
	}
	snapshot := func() string {
		t.Helper()
		var value string
		if err := pool.QueryRow(t.Context(), `SELECT json_build_array(
			(SELECT json_agg(x ORDER BY id) FROM invoices x),
			(SELECT json_agg(x ORDER BY id) FROM invoice_items x),
			(SELECT json_agg(x ORDER BY id) FROM receipts x),
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
		{"create", func() error {
			_, err := service.CreateInvoice(t.Context(), billingTestActor, CreateInvoiceRequest{PatientID: patient})
			return err
		}},
		{"add item", func() error {
			_, err := service.AddItem(t.Context(), billingTestActor, invoice.ID, AddItemRequest{Description: "Synthetic failed item", Quantity: 1, UnitPriceMinor: 20})
			return err
		}},
		{"remove item", func() error { return service.RemoveItem(t.Context(), billingTestActor, invoice.ID, item.ID) }},
		{"issue", func() error { _, err := service.IssueInvoice(t.Context(), billingTestActor, invoice.ID); return err }},
		{"void", func() error { return service.VoidInvoice(t.Context(), billingTestActor, invoice.ID) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var failure *pgconn.PgError
			if err := tc.mutate(); !errors.As(err, &failure) || failure.Code != "P0001" {
				t.Fatalf("mutation did not reach failing audit trigger: %v", err)
			}
			if after := snapshot(); after != before {
				t.Fatal("failed audit changed committed invoice, item, receipt or audit history")
			}
		})
	}
}
