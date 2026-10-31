-- TASK-PAT-01 (B; C reviews). Provisional synthetic-development fields under DEC02.
-- A must confirm this migration number before integration. Do not edit after application.
CREATE TABLE patients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
    phone text CHECK (phone IS NULL OR length(btrim(phone)) > 0),
    record_version bigint NOT NULL DEFAULT 1 CHECK (record_version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NOT NULL REFERENCES staff_accounts(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid NOT NULL REFERENCES staff_accounts(id)
);

CREATE INDEX patients_display_name_id_idx ON patients (display_name, id);

-- A missing NIC/passport has no row. Keep the original for staff and use the
-- generated canonical form as the database's race-safe uniqueness authority.
-- Provisional DEC02 rule: trim outer ASCII whitespace, remove ASCII spaces and
-- hyphens, then uppercase ASCII letters. NIC and passport are distinct scopes.
CREATE TABLE patient_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL UNIQUE REFERENCES patients(id),
    identity_type text NOT NULL CHECK (identity_type IN ('NIC', 'PASSPORT')),
    original_value text NOT NULL,
    canonical_value text GENERATED ALWAYS AS (
        translate(
            replace(replace(btrim(original_value, E' \t\n\r'), ' ', ''), '-', ''),
            'abcdefghijklmnopqrstuvwxyz',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        )
    ) STORED,
    CONSTRAINT patient_identities_canonical_nonempty CHECK (length(canonical_value) > 0),
    CONSTRAINT patient_identities_type_canonical_unique UNIQUE (identity_type, canonical_value)
);
