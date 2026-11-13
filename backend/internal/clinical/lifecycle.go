package clinical

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"ayurflow/backend/internal/audit"

	"github.com/jackc/pgx/v5"
)

func (s *Service) Hold(ctx context.Context, actor, planID string, version int64, reason string) (Plan, error) {
	return s.changeStatus(ctx, actor, planID, version, reason, "active", "held", "hold", nil)
}

func (s *Service) Resume(ctx context.Context, actor, planID string, version int64, reason string) (Plan, error) {
	return s.changeStatus(ctx, actor, planID, version, reason, "held", "active", "resume", nil)
}

func (s *Service) Cancel(ctx context.Context, actor, planID string, version int64, reason string) (Plan, error) {
	if s == nil || s.cancellation == nil {
		return Plan{}, ErrCompletionPending
	}
	return s.changeStatus(ctx, actor, planID, version, reason, "", "cancelled", "cancel", s.cancellation)
}

func (s *Service) changeStatus(ctx context.Context, actor, planID string, version int64, reason, from, to, action string, cancellation SessionCancellation) (Plan, error) {
	if !validUUID(actor) {
		return Plan{}, ErrForbidden
	}
	if !validUUID(planID) {
		return Plan{}, ErrNotFound
	}
	reason = strings.TrimSpace(reason)
	if version < 1 || reason == "" || !utf8.ValidString(reason) || len(reason) > 2048 {
		return Plan{}, ErrConflict
	}
	if s == nil || s.pool == nil {
		return Plan{}, ErrForbidden
	}
	var plan Plan
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var err error
		plan, err = lockPlan(ctx, tx, actor, planID)
		if err != nil {
			return err
		}
		if plan.Version != version || (from != "" && plan.Status != from) ||
			(from == "" && plan.Status != "active" && plan.Status != "held") {
			return ErrConflict
		}
		if cancellation != nil {
			if err := cancellation.CancelFuture(ctx, tx, planID, actor); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE care_plans SET status=$2,record_version=record_version+1,
			updated_at=clock_timestamp(),updated_by=$3 WHERE id=$1`, planID, to, actor); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO plan_decisions(plan_id,action,actor_id,reason,from_status,to_status)
			VALUES ($1,$2,$3,$4,$5,$6)`, planID, action, actor, reason, plan.Status, to); err != nil {
			return err
		}
		if err := audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "plan." + action,
			Object: audit.Object{Type: "care_plan", ID: planID}, ChangedFields: []string{"status"}}); err != nil {
			return err
		}
		plan.Status, plan.Version = to, plan.Version+1
		plan.PathwayState = pathwayState(plan.Status, plan.CurrentOrdinal)
		return nil
	})
	return plan, err
}

// RequireSessionClearance is called by C after therapist/session authorization
// in the same start transaction. The plan lock must precede any session lock.
func RequireSessionClearance(ctx context.Context, tx pgx.Tx, planID, stageID string) error {
	if tx == nil || !validUUID(planID) || !validUUID(stageID) {
		return ErrForbidden
	}
	var planStatus, stageStatus string
	var current, ordinal int
	err := tx.QueryRow(ctx, `SELECT p.status,p.current_stage_ordinal,s.status,s.ordinal
		FROM care_plans p JOIN plan_stages s ON s.plan_id=p.id
		WHERE p.id=$1 AND s.id=$2 FOR SHARE OF p,s`, planID, stageID).
		Scan(&planStatus, &current, &stageStatus, &ordinal)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if planStatus != "active" || ordinal != current || stageStatus != "approved" {
		return ErrConflict
	}
	return nil
}
