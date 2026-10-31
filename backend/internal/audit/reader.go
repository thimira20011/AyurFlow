package audit

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ReadAuthorizer must check explicit audit permission AND access to the target
// record. AUTH-03 supplies this adapter. There is no implicit administrator bypass.
type ReadAuthorizer interface {
	AuthorizeAuditRead(context.Context, string, Object) error
}

type Reader struct {
	pool       *pgxpool.Pool
	authorizer ReadAuthorizer
}

type Query struct {
	Object   Object
	BeforeID int64
	Limit    int
}

type Record struct {
	ID            int64     `json:"id"`
	ActorID       string    `json:"actorId"`
	Action        string    `json:"action"`
	ObjectType    string    `json:"objectType"`
	ObjectID      string    `json:"objectId"`
	ReasonCode    string    `json:"reasonCode,omitempty"`
	ChangedFields []string  `json:"changedFields"`
	OccurredAt    time.Time `json:"occurredAt"`
}

func NewReader(pool *pgxpool.Pool, authorizer ReadAuthorizer) *Reader {
	return &Reader{pool: pool, authorizer: authorizer}
}

// List returns only the requested object's metadata, in descending ID order.
// A full page may be followed with BeforeID set to its last record's ID.
func (r *Reader) List(ctx context.Context, requesterID string, query Query) ([]Record, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if r.authorizer == nil || !validUUID(requesterID) {
		return nil, ErrForbidden
	}
	validPage := query.Limit >= 0 && query.Limit <= 100 && query.BeforeID >= 0
	if !query.Object.valid() || !validPage {
		return nil, ErrInvalidQuery
	}
	if err := r.authorizer.AuthorizeAuditRead(ctx, requesterID, query.Object); err != nil {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		// Authorization internals must not disclose protected record existence.
		return nil, ErrForbidden
	}
	var active bool
	err := r.pool.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM staff_accounts WHERE id=$1 AND active
	)`, requesterID).Scan(&active)
	if err != nil {
		return nil, fmt.Errorf("check audit requester: %w", err)
	}
	if !active {
		return nil, ErrForbidden
	}
	limit := query.Limit
	if limit == 0 {
		limit = 25
	}
	rows, err := r.pool.Query(
		ctx,
		`SELECT id, actor_id::text, action, object_type, object_id, COALESCE(reason, ''),
		 changed_fields, occurred_at FROM audit_events
		 WHERE object_type=$1 AND object_id=$2 AND ($3::bigint=0 OR id < $3)
		 AND EXISTS (SELECT 1 FROM staff_accounts WHERE id=$4 AND active)
		 ORDER BY id DESC LIMIT $5`,
		query.Object.Type,
		query.Object.ID,
		query.BeforeID,
		requesterID,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("read audit events: %w", err)
	}
	defer rows.Close()
	records := make([]Record, 0)
	for rows.Next() {
		var record Record
		if err := rows.Scan(
			&record.ID,
			&record.ActorID,
			&record.Action,
			&record.ObjectType,
			&record.ObjectID,
			&record.ReasonCode,
			&record.ChangedFields,
			&record.OccurredAt,
		); err != nil {
			return nil, fmt.Errorf("scan audit event: %w", err)
		}
		record.OccurredAt = record.OccurredAt.UTC()
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate audit events: %w", err)
	}
	return records, nil
}
