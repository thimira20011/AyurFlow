//go:build integration

package audit

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestReaderScopeAndPermissionsIntegration(t *testing.T) {
	pool := auditTestDatabase(t)
	object := validEvent().Object
	tx := beginAuditMutation(t, pool, "readable")
	for range 3 {
		if err := Write(t.Context(), tx, validEvent()); err != nil {
			t.Fatal(err)
		}
	}
	hidden := validEvent()
	hidden.Object.ID = "another-record"
	if err := Write(t.Context(), tx, hidden); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(t.Context()); err != nil {
		t.Fatal(err)
	}
	authorize := readAuthorizerFunc(func(_ context.Context, actor string, target Object) error {
		if actor != syntheticActor || target != object {
			return ErrForbidden
		}
		return nil
	})
	reader := NewReader(pool, authorize)
	first, err := reader.List(t.Context(), syntheticActor, Query{Object: object, Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 2 || first[0].ID <= first[1].ID || first[0].OccurredAt.Location() != time.UTC {
		t.Fatalf("unexpected first page: %+v", first)
	}
	second, err := reader.List(t.Context(), syntheticActor, Query{Object: object, Limit: 2, BeforeID: first[1].ID})
	if err != nil || len(second) != 1 || second[0].ID >= first[1].ID {
		t.Fatalf("unexpected second page: %+v, %v", second, err)
	}
	if _, err := reader.List(t.Context(), syntheticActor, Query{Object: hidden.Object}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("forbidden object leaked: %v", err)
	}
	if _, err := pool.Exec(t.Context(), `UPDATE staff_accounts SET active=false WHERE id=$1`, syntheticActor); err != nil {
		t.Fatal(err)
	}
	if _, err := reader.List(t.Context(), syntheticActor, Query{Object: object}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("disabled staff could read audit metadata: %v", err)
	}
}
