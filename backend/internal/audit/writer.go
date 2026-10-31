package audit

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// Write inserts an event in the caller's top-level business transaction. It never
// commits. Any failure rolls back that transaction, including validation failures,
// so an accidentally ignored audit error cannot commit the earlier mutation.
func Write(ctx context.Context, tx pgx.Tx, event Event) error {
	if tx == nil {
		return ErrTransactionRequired
	}
	if err := event.validate(); err != nil {
		return abort(ctx, tx, err)
	}
	fields := append([]string{}, event.ChangedFields...)
	_, err := tx.Exec(
		ctx,
		`INSERT INTO audit_events(actor_id, action, object_type, object_id, reason, changed_fields)
		 VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6)`,
		event.ActorID,
		event.Action,
		event.Object.Type,
		event.Object.ID,
		event.ReasonCode,
		fields,
	)
	if err != nil {
		return abort(ctx, tx, fmt.Errorf("insert audit event: %w", err))
	}
	return nil
}

func abort(ctx context.Context, tx pgx.Tx, cause error) error {
	// A canceled request must still release the transaction. This detached context
	// is bounded and used only for cleanup, never for a business write.
	cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := tx.Rollback(cleanup); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
		return errors.Join(cause, fmt.Errorf("rollback audited transaction: %w", err))
	}
	return cause
}
