-- TASK-PAT-01/02: structured postal code for the phone-absent identity fallback.
-- Existing records may be incomplete; the service enforces a contact method on new writes.
ALTER TABLE patients ADD COLUMN postal_code text;
ALTER TABLE patients ADD CONSTRAINT patients_postal_code_format
    CHECK (postal_code IS NULL OR postal_code ~ '^[A-Z0-9][A-Z0-9-]{1,15}$') NOT VALID;
