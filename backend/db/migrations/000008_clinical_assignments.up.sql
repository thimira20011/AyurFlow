-- TASK-CON-01: explicit patient/clinician record access for synthetic development.
-- Grant/revoke authority remains a DEC02 gate; there is no assignment HTTP route.
CREATE TABLE patient_clinician_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patients(id),
    clinician_id uuid NOT NULL REFERENCES staff_accounts(id),
    granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    granted_by uuid NOT NULL REFERENCES staff_accounts(id),
    revoked_at timestamptz,
    revoked_by uuid REFERENCES staff_accounts(id),
    CONSTRAINT assignment_revocation_pair CHECK ((revoked_at IS NULL) = (revoked_by IS NULL)),
    CONSTRAINT assignment_revocation_order CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE UNIQUE INDEX patient_clinician_active_unique
    ON patient_clinician_assignments (patient_id, clinician_id) WHERE revoked_at IS NULL;
CREATE INDEX patient_clinician_actor_idx
    ON patient_clinician_assignments (clinician_id, patient_id) WHERE revoked_at IS NULL;
