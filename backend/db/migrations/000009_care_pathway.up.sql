-- TASK-CLN-01 (B; C reviews). Structure for one ordered pathway per care plan.
-- DEC02 supplies the final labels and required checklist items before plans
-- are created through the API. This migration seeds no clinic pathway.

-- A source consultation is optional, but when present it must belong to the
-- same patient as the plan. A consultation can still exist without a plan.
ALTER TABLE consultations ADD CONSTRAINT consultations_id_patient_unique UNIQUE (id, patient_id);

CREATE TABLE care_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patients(id),
    source_consultation_id uuid,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'held', 'cancelled', 'completed')),
    current_stage_ordinal integer CHECK (current_stage_ordinal > 0),
    record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    created_by uuid NOT NULL REFERENCES staff_accounts(id),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_by uuid NOT NULL REFERENCES staff_accounts(id),
    CONSTRAINT care_plans_source_patient_fk FOREIGN KEY (source_consultation_id, patient_id)
        REFERENCES consultations(id, patient_id),
    CONSTRAINT care_plans_current_required CHECK (
        status NOT IN ('active', 'held') OR current_stage_ordinal IS NOT NULL
    ),
    CONSTRAINT care_plans_draft_has_no_current CHECK (
        status <> 'draft' OR current_stage_ordinal IS NULL
    )
);

CREATE TABLE plan_stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES care_plans(id),
    ordinal integer NOT NULL CHECK (ordinal > 0),
    label text NOT NULL CHECK (length(btrim(label)) > 0 AND octet_length(label) <= 200),
    required_checks text[] NOT NULL DEFAULT '{}'::text[],
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'completed')),
    approved_by uuid REFERENCES staff_accounts(id),
    approved_at timestamptz,
    completed_by uuid REFERENCES staff_accounts(id),
    completed_at timestamptz,
    CONSTRAINT plan_stages_plan_ordinal_unique UNIQUE (plan_id, ordinal),
    CONSTRAINT plan_stages_id_plan_unique UNIQUE (id, plan_id),
    CONSTRAINT plan_stages_approval_pair CHECK ((approved_by IS NULL) = (approved_at IS NULL)),
    CONSTRAINT plan_stages_completion_pair CHECK ((completed_by IS NULL) = (completed_at IS NULL)),
    CONSTRAINT plan_stages_decision_state CHECK (
        (status = 'pending' AND approved_at IS NULL AND completed_at IS NULL) OR
        (status = 'approved' AND approved_at IS NOT NULL AND completed_at IS NULL) OR
        (status = 'completed' AND approved_at IS NOT NULL AND completed_at IS NOT NULL)
    ),
    CONSTRAINT plan_stages_decision_order CHECK (
        completed_at IS NULL OR completed_at >= approved_at
    )
);

ALTER TABLE care_plans ADD CONSTRAINT care_plans_current_stage_fk
    FOREIGN KEY (id, current_stage_ordinal) REFERENCES plan_stages(plan_id, ordinal)
    DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX care_plans_patient_created_idx ON care_plans(patient_id, created_at DESC, id DESC);

-- Decisions are separate from mutable plan state so later hold/cancel and
-- advancement operations can retain their actor, time and reason history.
CREATE TABLE plan_decisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES care_plans(id),
    stage_id uuid,
    action text NOT NULL CHECK (action IN ('approve', 'advance', 'hold', 'resume', 'cancel', 'complete')),
    actor_id uuid NOT NULL REFERENCES staff_accounts(id),
    recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    reason text,
    from_status text,
    to_status text,
    CONSTRAINT plan_decisions_stage_plan_fk FOREIGN KEY (stage_id, plan_id)
        REFERENCES plan_stages(id, plan_id),
    CONSTRAINT plan_decisions_reason_nonblank CHECK (reason IS NULL OR length(btrim(reason)) > 0)
);
CREATE INDEX plan_decisions_plan_recorded_idx ON plan_decisions(plan_id, recorded_at, id);

CREATE FUNCTION reject_plan_decision_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'plan decisions are append-only';
END;
$$;
CREATE TRIGGER plan_decisions_append_only
    BEFORE UPDATE OR DELETE ON plan_decisions
    FOR EACH ROW EXECUTE FUNCTION reject_plan_decision_change();
