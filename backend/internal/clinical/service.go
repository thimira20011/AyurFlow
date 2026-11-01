package clinical

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"ayurflow/backend/internal/audit"
	"ayurflow/backend/internal/consultations"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrForbidden         = errors.New("clinical: access denied")
	ErrNotFound          = errors.New("clinical: plan not found")
	ErrInvalidPathway    = errors.New("clinical: invalid pathway")
	ErrConflict          = errors.New("clinical: plan state conflict")
	ErrCompletionPending = errors.New("clinical: completion evidence pending")
)

type StageDefinition struct {
	Label          string
	RequiredChecks []string
}

type Plan struct {
	ID             string `json:"id"`
	PatientID      string `json:"patientId"`
	Status         string `json:"status"`
	CurrentOrdinal int    `json:"currentStageOrdinal"`
	Version        int64  `json:"version"`
}

// CompletionPolicy checks clinic-approved completion evidence in the caller's
// transaction. Nil denies advancement until DEC02 and C's session join exist.
type CompletionPolicy interface {
	CanComplete(context.Context, pgx.Tx, string, string) error
}

type Service struct {
	pool       *pgxpool.Pool
	pathway    []StageDefinition
	completion CompletionPolicy
}

func NewService(pool *pgxpool.Pool, pathway []StageDefinition, completion CompletionPolicy) *Service {
	copyPathway := make([]StageDefinition, len(pathway))
	for i, stage := range pathway {
		copyPathway[i] = StageDefinition{Label: stage.Label, RequiredChecks: append([]string{}, stage.RequiredChecks...)}
	}
	return &Service{pool: pool, pathway: copyPathway, completion: completion}
}

func (s *Service) Create(ctx context.Context, actor, patientID, sourceConsultationID string) (Plan, error) {
	if !validUUID(actor) {
		return Plan{}, ErrForbidden
	}
	if !validUUID(patientID) || (sourceConsultationID != "" && !validUUID(sourceConsultationID)) {
		return Plan{}, ErrNotFound
	}
	if s == nil || s.pool == nil || !validPathway(s.pathway) {
		return Plan{}, ErrInvalidPathway
	}
	var plan Plan
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := requireClinicalWrite(ctx, tx, actor, patientID); err != nil {
			return err
		}
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM patients WHERE id=$1)`, patientID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return ErrNotFound
		}
		var source any
		if sourceConsultationID != "" {
			source = sourceConsultationID
		}
		if err := tx.QueryRow(ctx, `INSERT INTO care_plans(patient_id,source_consultation_id,created_by,updated_by)
			VALUES ($1,$2,$3,$3) RETURNING id::text`, patientID, source, actor).Scan(&plan.ID); err != nil {
			return safePlanError(err)
		}
		for ordinal, stage := range s.pathway {
			checks := append([]string{}, stage.RequiredChecks...)
			if _, err := tx.Exec(ctx, `INSERT INTO plan_stages(plan_id,ordinal,label,required_checks)
				VALUES ($1,$2,$3,$4)`, plan.ID, ordinal+1, stage.Label, checks); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE care_plans SET status='active',current_stage_ordinal=1 WHERE id=$1`, plan.ID); err != nil {
			return err
		}
		if err := audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "plan.created",
			Object: audit.Object{Type: "care_plan", ID: plan.ID}}); err != nil {
			return err
		}
		plan.PatientID, plan.Status, plan.CurrentOrdinal, plan.Version = patientID, "active", 1, 1
		return nil
	})
	return plan, err
}

func (s *Service) Approve(ctx context.Context, actor, planID, stageID string, version int64, confirmedChecks []string) (Plan, error) {
	if !validUUID(actor) {
		return Plan{}, ErrForbidden
	}
	if !validUUID(planID) || !validUUID(stageID) {
		return Plan{}, ErrNotFound
	}
	if version < 1 {
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
		if plan.Status != "active" || plan.Version != version {
			return ErrConflict
		}
		var ordinal int
		var status string
		var required []string
		err = tx.QueryRow(ctx, `SELECT ordinal,status,required_checks FROM plan_stages
			WHERE id=$1 AND plan_id=$2 FOR UPDATE`, stageID, planID).Scan(&ordinal, &status, &required)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if ordinal != plan.CurrentOrdinal || status != "pending" || !sameChecks(required, confirmedChecks) {
			return ErrConflict
		}
		if _, err := tx.Exec(ctx, `UPDATE plan_stages SET status='approved',approved_by=$2,approved_at=clock_timestamp()
			WHERE id=$1`, stageID, actor); err != nil {
			return err
		}
		if err := recordDecision(ctx, tx, actor, planID, stageID, "approve", "pending", "approved"); err != nil {
			return err
		}
		if err := bumpPlan(ctx, tx, actor, planID); err != nil {
			return err
		}
		if err := audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "plan.stage_approved",
			Object: audit.Object{Type: "care_plan", ID: planID}, ChangedFields: []string{"stage_status"}}); err != nil {
			return err
		}
		plan.Version++
		return nil
	})
	return plan, err
}

func (s *Service) Advance(ctx context.Context, actor, planID string, version int64) (Plan, error) {
	if !validUUID(actor) {
		return Plan{}, ErrForbidden
	}
	if !validUUID(planID) {
		return Plan{}, ErrNotFound
	}
	if version < 1 {
		return Plan{}, ErrConflict
	}
	if s == nil || s.pool == nil {
		return Plan{}, ErrForbidden
	}
	if s.completion == nil {
		return Plan{}, ErrCompletionPending
	}
	var plan Plan
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var err error
		plan, err = lockPlan(ctx, tx, actor, planID)
		if err != nil {
			return err
		}
		if plan.Status != "active" || plan.Version != version {
			return ErrConflict
		}
		var stageID, status string
		err = tx.QueryRow(ctx, `SELECT id::text,status FROM plan_stages
			WHERE plan_id=$1 AND ordinal=$2 FOR UPDATE`, planID, plan.CurrentOrdinal).Scan(&stageID, &status)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrConflict
		}
		if err != nil {
			return err
		}
		if status != "approved" {
			return ErrConflict
		}
		if err := s.completion.CanComplete(ctx, tx, planID, stageID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE plan_stages SET status='completed',completed_by=$2,
			completed_at=GREATEST(clock_timestamp(),approved_at) WHERE id=$1`, stageID, actor); err != nil {
			return err
		}
		var nextOrdinal int
		err = tx.QueryRow(ctx, `SELECT ordinal FROM plan_stages WHERE plan_id=$1 AND ordinal=$2`,
			planID, plan.CurrentOrdinal+1).Scan(&nextOrdinal)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		if errors.Is(err, pgx.ErrNoRows) {
			if _, err := tx.Exec(ctx, `UPDATE care_plans SET status='completed',record_version=record_version+1,
				updated_at=clock_timestamp(),updated_by=$2 WHERE id=$1`, planID, actor); err != nil {
				return err
			}
			plan.Status = "completed"
		} else {
			if _, err := tx.Exec(ctx, `UPDATE care_plans SET current_stage_ordinal=$2,
				record_version=record_version+1,updated_at=clock_timestamp(),updated_by=$3 WHERE id=$1`,
				planID, nextOrdinal, actor); err != nil {
				return err
			}
			plan.CurrentOrdinal = nextOrdinal
		}
		if err := recordDecision(ctx, tx, actor, planID, stageID, "advance", "approved", "completed"); err != nil {
			return err
		}
		if err := audit.Write(ctx, tx, audit.Event{ActorID: actor, Action: "plan.advanced",
			Object: audit.Object{Type: "care_plan", ID: planID}, ChangedFields: []string{"current_stage_ordinal", "status"}}); err != nil {
			return err
		}
		plan.Version++
		return nil
	})
	return plan, err
}

func lockPlan(ctx context.Context, tx pgx.Tx, actor, id string) (Plan, error) {
	var plan Plan
	err := tx.QueryRow(ctx, `SELECT id::text,patient_id::text FROM care_plans WHERE id=$1`, id).Scan(&plan.ID, &plan.PatientID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Plan{}, ErrNotFound
	}
	if err != nil {
		return Plan{}, err
	}
	if err := requireClinicalWrite(ctx, tx, actor, plan.PatientID); err != nil {
		return Plan{}, err
	}
	var current pgtype.Int4
	err = tx.QueryRow(ctx, `SELECT status,current_stage_ordinal,record_version FROM care_plans
		WHERE id=$1 FOR UPDATE`, id).Scan(&plan.Status, &current, &plan.Version)
	if current.Valid {
		plan.CurrentOrdinal = int(current.Int32)
	}
	return plan, err
}

func requireClinicalWrite(ctx context.Context, tx pgx.Tx, actor, patientID string) error {
	err := (consultations.AssignedPolicy{}).CanCreate(ctx, tx, actor, patientID)
	if errors.Is(err, consultations.ErrForbidden) {
		return ErrForbidden
	}
	return err
}

func recordDecision(ctx context.Context, tx pgx.Tx, actor, planID, stageID, action, from, to string) error {
	_, err := tx.Exec(ctx, `INSERT INTO plan_decisions(plan_id,stage_id,action,actor_id,from_status,to_status)
		VALUES ($1,$2,$3,$4,$5,$6)`, planID, stageID, action, actor, from, to)
	return err
}

func bumpPlan(ctx context.Context, tx pgx.Tx, actor, id string) error {
	_, err := tx.Exec(ctx, `UPDATE care_plans SET record_version=record_version+1,
		updated_at=clock_timestamp(),updated_by=$2 WHERE id=$1`, id, actor)
	return err
}

func validPathway(stages []StageDefinition) bool {
	if len(stages) == 0 || len(stages) > 16 {
		return false
	}
	for _, stage := range stages {
		if !utf8.ValidString(stage.Label) || strings.TrimSpace(stage.Label) == "" || len(stage.Label) > 200 {
			return false
		}
		seen := make(map[string]bool, len(stage.RequiredChecks))
		for _, check := range stage.RequiredChecks {
			if !utf8.ValidString(check) || strings.TrimSpace(check) == "" || len(check) > 200 || seen[check] {
				return false
			}
			seen[check] = true
		}
	}
	return true
}

func sameChecks(required, confirmed []string) bool {
	if len(required) != len(confirmed) {
		return false
	}
	seen := make(map[string]bool, len(required))
	for _, check := range required {
		seen[check] = true
	}
	if len(seen) != len(required) {
		return false
	}
	for _, check := range confirmed {
		if !seen[check] {
			return false
		}
		delete(seen, check)
	}
	return len(seen) == 0
}

func validUUID(value string) bool {
	var id pgtype.UUID
	return id.Scan(value) == nil && id.Valid && id.Bytes != [16]byte{}
}

func safePlanError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		return ErrNotFound
	}
	return err
}
