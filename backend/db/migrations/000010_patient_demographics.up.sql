-- TASK-PAT-01/02: add the DEC02 candidate demographic fields without changing
-- previously applied patient migrations or requiring a supplied identity.
ALTER TABLE patients
    ADD COLUMN birth_date date,
    ADD COLUMN gender text,
    ADD COLUMN address text;

-- Legacy rows may lack these values. New writes must use the approved values;
-- a later backfill can validate constraints and make required columns NOT NULL.
ALTER TABLE patients ADD CONSTRAINT patients_gender_dec02
    CHECK (gender IS NULL OR gender IN ('MALE','FEMALE','OTHER','UNDISCLOSED')) NOT VALID;
ALTER TABLE patients ADD CONSTRAINT patients_phone_dec02
    CHECK (phone IS NULL OR phone ~ '^\+947[0-9]{8}$') NOT VALID;
ALTER TABLE patients ADD CONSTRAINT patients_address_dec02
    CHECK (address IS NULL OR (length(btrim(address)) > 0 AND octet_length(address) <= 1024)) NOT VALID;

-- A short display reference is separate from the immutable UUID primary key.
CREATE SEQUENCE patient_registry_numbers AS bigint START WITH 1;
ALTER TABLE patients ADD COLUMN registry_number bigint DEFAULT nextval('patient_registry_numbers');
UPDATE patients SET registry_number=nextval('patient_registry_numbers') WHERE registry_number IS NULL;
ALTER TABLE patients ALTER COLUMN registry_number SET NOT NULL;
ALTER SEQUENCE patient_registry_numbers OWNED BY patients.registry_number;
CREATE UNIQUE INDEX patients_registry_number_unique ON patients(registry_number);
