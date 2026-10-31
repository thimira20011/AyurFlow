package clinical

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type Stage struct {
	ID              string     `json:"id"`
	Code            string     `json:"code"`
	Ordinal         int        `json:"ordinal"`
	Label           string     `json:"label"`
	RequiredChecks  []string   `json:"requiredChecks"`
	ConfirmedChecks []string   `json:"confirmedChecks"`
	Status          string     `json:"status"`
	ApprovedBy      *string    `json:"approvedBy"`
	ApprovedAt      *time.Time `json:"approvedAt"`
	CompletedBy     *string    `json:"completedBy"`
	CompletedAt     *time.Time `json:"completedAt"`
}

type Decision struct {
	ID         string    `json:"id"`
	Action     string    `json:"action"`
	ActorID    string    `json:"actorId"`
	RecordedAt time.Time `json:"recordedAt"`
	Reason     *string   `json:"reason"`
	FromStatus *string   `json:"fromStatus"`
	ToStatus   *string   `json:"toStatus"`
}

type Detail struct {
	Plan
	Stages    []Stage    `json:"stages"`
	Decisions []Decision `json:"decisions"`
}

func (s *Service) Get(ctx context.Context, actor, planID string) (Detail, error) {
	if !validUUID(actor) {
		return Detail{}, ErrForbidden
	}
	if !validUUID(planID) {
		return Detail{}, ErrNotFound
	}
	if s == nil || s.pool == nil {
		return Detail{}, ErrForbidden
	}
	var detail Detail
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var err error
		detail.Plan, err = lockPlan(ctx, tx, actor, planID)
		if err != nil {
			return err
		}
		detail.Stages = []Stage{}
		stages, err := tx.Query(ctx, `SELECT id::text,COALESCE(stage_code,''),ordinal,label,required_checks,
			confirmed_checks,status,approved_by::text,approved_at,completed_by::text,completed_at
			FROM plan_stages WHERE plan_id=$1 ORDER BY ordinal`, planID)
		if err != nil {
			return err
		}
		for stages.Next() {
			var stage Stage
			if err := stages.Scan(&stage.ID, &stage.Code, &stage.Ordinal, &stage.Label,
				&stage.RequiredChecks, &stage.ConfirmedChecks, &stage.Status,
				&stage.ApprovedBy, &stage.ApprovedAt, &stage.CompletedBy, &stage.CompletedAt); err != nil {
				stages.Close()
				return err
			}
			detail.Stages = append(detail.Stages, stage)
		}
		err = stages.Err()
		stages.Close()
		if err != nil {
			return err
		}
		detail.Decisions = []Decision{}
		decisions, err := tx.Query(ctx, `SELECT id::text,action,actor_id::text,recorded_at,
			reason,from_status,to_status FROM plan_decisions
			WHERE plan_id=$1 ORDER BY recorded_at,id`, planID)
		if err != nil {
			return err
		}
		for decisions.Next() {
			var decision Decision
			if err := decisions.Scan(&decision.ID, &decision.Action, &decision.ActorID,
				&decision.RecordedAt, &decision.Reason, &decision.FromStatus, &decision.ToStatus); err != nil {
				decisions.Close()
				return err
			}
			detail.Decisions = append(detail.Decisions, decision)
		}
		err = decisions.Err()
		decisions.Close()
		return err
	})
	return detail, err
}

func (s *Service) List(ctx context.Context, actor, patientID string) ([]Plan, error) {
	if !validUUID(actor) {
		return nil, ErrForbidden
	}
	if !validUUID(patientID) {
		return nil, ErrNotFound
	}
	if s == nil || s.pool == nil {
		return nil, ErrForbidden
	}
	items := []Plan{}
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := requireClinicalWrite(ctx, tx, actor, patientID); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `SELECT id::text,status,current_stage_ordinal,record_version
			FROM care_plans WHERE patient_id=$1 ORDER BY created_at DESC,id DESC LIMIT 25`, patientID)
		if err != nil {
			return err
		}
		for rows.Next() {
			var item Plan
			var current pgtype.Int4
			if err := rows.Scan(&item.ID, &item.Status, &current, &item.Version); err != nil {
				rows.Close()
				return err
			}
			item.PatientID = patientID
			if current.Valid {
				item.CurrentOrdinal = int(current.Int32)
			}
			item.PathwayState = pathwayState(item.Status, item.CurrentOrdinal)
			items = append(items, item)
		}
		err = rows.Err()
		rows.Close()
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return items, err
}
