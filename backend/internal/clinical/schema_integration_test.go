//go:build integration

package clinical

import (
	"context"
	"testing"
	"time"

	"ayurflow/backend/internal/testutil"
)

func TestCarePathwaySchemaIntegration(t *testing.T) {
	pool := testutil.Postgres(t)
	ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
	defer cancel()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	var actor, patient, otherPatient, consultation, plan, stage, otherPlan string
	if err := tx.QueryRow(ctx, `INSERT INTO staff_accounts(login_identifier,password_hash)
		VALUES ('synthetic-pathway-actor','$argon2id$synthetic-test-only') RETURNING id::text`).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	for _, target := range []*string{&patient, &otherPatient} {
		if err := tx.QueryRow(ctx, `INSERT INTO patients(display_name,created_by,updated_by)
			VALUES ('Synthetic pathway patient',$1,$1) RETURNING id::text`, actor).Scan(target); err != nil {
			t.Fatal(err)
		}
	}
	if err := tx.QueryRow(ctx, `INSERT INTO consultations(patient_id,draft_text,created_by,updated_by)
		VALUES ($1,'Synthetic draft',$2,$2) RETURNING id::text`, patient, actor).Scan(&consultation); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, `INSERT INTO care_plans(patient_id,source_consultation_id,created_by,updated_by)
		VALUES ($1,$2,$3,$3) RETURNING id::text`, patient, consultation, actor).Scan(&plan); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, `INSERT INTO plan_stages(plan_id,ordinal,label,required_checks)
		VALUES ($1,1,'Preparatory',ARRAY['Synthetic review']) RETURNING id::text`, plan).Scan(&stage); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `UPDATE care_plans SET status='active',current_stage_ordinal=1 WHERE id=$1`, plan); err != nil {
		t.Fatal(err)
	}
	if err := tx.QueryRow(ctx, `INSERT INTO care_plans(patient_id,created_by,updated_by)
		VALUES ($1,$2,$2) RETURNING id::text`, otherPatient, actor).Scan(&otherPlan); err != nil {
		t.Fatal(err)
	}
	// Invalid statements run in savepoints so the surrounding fixture remains usable.
	for name, query := range map[string]struct {
		query string
		args  []any
	}{
		"wrong patient consultation": {`INSERT INTO care_plans(patient_id,source_consultation_id,created_by,updated_by)
			VALUES ($1,$2,$3,$3)`, []any{otherPatient, consultation, actor}},
		"duplicate stage ordinal": {`INSERT INTO plan_stages(plan_id,ordinal,label)
			VALUES ($1,1,'Duplicate')`, []any{plan}},
		"approval without actor": {`UPDATE plan_stages SET status='approved',approved_at=clock_timestamp()
			WHERE id=$1`, []any{stage}},
		"decision for another plan stage": {`INSERT INTO plan_decisions(plan_id,stage_id,action,actor_id)
			VALUES ($1,$2,'approve',$3)`, []any{otherPlan, stage, actor}},
	} {
		if _, err := tx.Exec(ctx, `SAVEPOINT invalid_case`); err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, query.query, query.args...); err == nil {
			t.Errorf("%s accepted", name)
		}
		if _, err := tx.Exec(ctx, `ROLLBACK TO SAVEPOINT invalid_case`); err != nil {
			t.Fatal(err)
		}
	}
	var decision string
	if err := tx.QueryRow(ctx, `INSERT INTO plan_decisions(plan_id,stage_id,action,actor_id)
		VALUES ($1,$2,'approve',$3) RETURNING id::text`, plan, stage, actor).Scan(&decision); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `SAVEPOINT immutable_case`); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM plan_decisions WHERE id=$1`, decision); err == nil {
		t.Fatal("decision history was deletable")
	}
	if _, err := tx.Exec(ctx, `ROLLBACK TO SAVEPOINT immutable_case`); err != nil {
		t.Fatal(err)
	}
	var label string
	var checks []string
	if err := tx.QueryRow(ctx, `SELECT label,required_checks FROM plan_stages WHERE id=$1`, stage).Scan(&label, &checks); err != nil || label != "Preparatory" || len(checks) != 1 || checks[0] != "Synthetic review" {
		t.Fatalf("stage snapshot label=%q checks=%v err=%v", label, checks, err)
	}
}
