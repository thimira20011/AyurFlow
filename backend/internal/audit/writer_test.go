package audit

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type fakeTx struct {
	pgx.Tx
	execError       error
	rollbackError   error
	execs           int
	commits         int
	rollbacks       int
	cleanupCanceled bool
}

func (tx *fakeTx) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	tx.execs++
	return pgconn.NewCommandTag("INSERT 0 1"), tx.execError
}

func (tx *fakeTx) Commit(context.Context) error {
	tx.commits++
	return nil
}

func (tx *fakeTx) Rollback(ctx context.Context) error {
	tx.rollbacks++
	tx.cleanupCanceled = ctx.Err() != nil
	return tx.rollbackError
}

func TestWriteRequiresTransactionAndNeverCommits(t *testing.T) {
	t.Parallel()
	if err := Write(t.Context(), nil, validEvent()); !errors.Is(err, ErrTransactionRequired) {
		t.Fatalf("missing transaction: %v", err)
	}
	tx := &fakeTx{}
	if err := Write(t.Context(), tx, validEvent()); err != nil {
		t.Fatal(err)
	}
	if tx.execs != 1 || tx.commits != 0 || tx.rollbacks != 0 {
		t.Fatalf("writer took over transaction: %+v", tx)
	}
}

func TestWriteAbortsTransactionOnEveryFailure(t *testing.T) {
	t.Parallel()
	databaseFailure := errors.New("synthetic database failure")
	rollbackFailure := errors.New("synthetic rollback failure")
	tests := []struct {
		name          string
		event         Event
		execError     error
		rollbackError error
		want          error
	}{
		{name: "invalid event", event: Event{}, want: ErrInvalidEvent},
		{name: "database failure", event: validEvent(), execError: databaseFailure, want: databaseFailure},
		{name: "rollback failure", event: Event{}, rollbackError: rollbackFailure, want: rollbackFailure},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tx := &fakeTx{execError: tc.execError, rollbackError: tc.rollbackError}
			if err := Write(t.Context(), tx, tc.event); !errors.Is(err, tc.want) {
				t.Fatalf("error = %v, want %v", err, tc.want)
			}
			if tx.rollbacks != 1 || tx.commits != 0 {
				t.Fatal("failed audit write did not abort the transaction")
			}
		})
	}
}

func TestWriteCanRollbackAfterRequestCancellation(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	tx := &fakeTx{execError: context.Canceled}
	if err := Write(ctx, tx, validEvent()); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled write: %v", err)
	}
	if tx.cleanupCanceled || tx.rollbacks != 1 {
		t.Fatal("request cancellation prevented transaction cleanup")
	}
}
