-- TASK-CON-01 (B; C reviews). Draft-only clinical records for synthetic development.
-- No care-plan reference: a consultation may exist before any plan is created.
-- CON-02 must use a new migration to add signing/addenda and replace the
-- draft-only status constraint; do not edit this migration after application.
CREATE TABLE consultations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patients(id),
    status text NOT NULL DEFAULT 'draft',
    draft_text text NOT NULL,
    record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NOT NULL REFERENCES staff_accounts(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid NOT NULL REFERENCES staff_accounts(id),
    CONSTRAINT consultations_draft_only CHECK (status = 'draft'),
    CONSTRAINT consultations_draft_text_valid CHECK (
        length(btrim(draft_text)) > 0 AND octet_length(draft_text) <= 65536
    )
);

CREATE INDEX consultations_patient_created_id_idx
    ON consultations (patient_id, created_at DESC, id DESC);
