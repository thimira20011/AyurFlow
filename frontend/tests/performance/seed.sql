-- The fullstack launcher checks for an empty loopback database before migration.
BEGIN;

CREATE TEMP TABLE at14_staff ON COMMIT DROP AS
SELECT
    (SELECT id FROM staff_accounts WHERE login_identifier = :'reception') AS reception,
    (SELECT id FROM staff_accounts WHERE login_identifier = :'therapist') AS therapist;

INSERT INTO patients (display_name, birth_date, gender, created_by, updated_by)
SELECT 'Synthetic AT14 Patient ' || lpad(n::text, 3, '0'), DATE '1990-01-01', 'UNDISCLOSED', reception, reception
FROM generate_series(1, 500) n CROSS JOIN at14_staff;

INSERT INTO care_plans (patient_id, created_by, updated_by)
SELECT patients.id, reception, reception FROM patients CROSS JOIN at14_staff;

INSERT INTO plan_stages (plan_id, ordinal, label, stage_code, status, approved_by, approved_at)
SELECT care_plans.id, 1, 'PREPARATORY', 'PREPARATORY', 'approved', reception, now()
FROM care_plans CROSS JOIN at14_staff;

UPDATE care_plans SET status = 'active', current_stage_ordinal = 1;

INSERT INTO clinic_rooms (code, name, created_by)
SELECT 'AT14-ROOM', 'Synthetic AT14 Room', reception FROM at14_staff;

CREATE TEMP TABLE at14_days ON COMMIT DROP AS
SELECT (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + d * interval '1 day' AS day_start
FROM generate_series(1, 10) d;

INSERT INTO resource_availability (room_id, starts_at, ends_at, created_by)
SELECT clinic_rooms.id, day_start, day_start + interval '10 hours', reception
FROM clinic_rooms CROSS JOIN at14_days CROSS JOIN at14_staff;

INSERT INTO resource_availability (therapist_id, starts_at, ends_at, created_by)
SELECT therapist, day_start, day_start + interval '10 hours', reception FROM at14_days CROSS JOIN at14_staff;

WITH scheduled AS (
    SELECT care_plans.patient_id, care_plans.id AS plan_id, plan_stages.id AS stage_id,
           (row_number() OVER (ORDER BY care_plans.patient_id, slot) - 1)::int AS n
    FROM care_plans JOIN plan_stages ON plan_stages.plan_id = care_plans.id CROSS JOIN generate_series(1, 2) slot
), days AS (
    SELECT day_start, row_number() OVER (ORDER BY day_start) - 1 AS n FROM at14_days
)
INSERT INTO therapy_sessions (patient_id, plan_id, stage_id, room_id, therapist_id,
                             starts_at, ends_at, created_by, updated_by)
SELECT scheduled.patient_id, plan_id, stage_id, clinic_rooms.id, therapist,
       day_start + (scheduled.n % 100) * interval '6 minutes',
       day_start + (scheduled.n % 100 + 1) * interval '6 minutes', reception, reception
FROM scheduled JOIN days ON scheduled.n / 100 = days.n
CROSS JOIN clinic_rooms CROSS JOIN at14_staff;

INSERT INTO botanical_items (code, display_name, created_by)
SELECT 'AT14-HERB', 'Synthetic AT14 Botanical', reception FROM at14_staff;

INSERT INTO stock_batches (item_id, batch_reference, received_grams, remaining_grams, expires_at, received_by)
SELECT botanical_items.id, 'AT14-' || n, 100, 100, current_date + 365, reception
FROM botanical_items CROSS JOIN generate_series(1, 200) n CROSS JOIN at14_staff;

INSERT INTO invoices (patient_id) SELECT id FROM patients;
INSERT INTO invoice_items (invoice_id, description, quantity, unit_price_minor)
SELECT id, 'Synthetic AT14 service', 1, 10000 FROM invoices;
UPDATE invoices SET status = 'issued', total_minor_units = 10000, issued_at = now(),
    issued_by = (SELECT reception FROM at14_staff);

ANALYZE;
SELECT json_build_object(
    'patients', (SELECT count(*) FROM patients),
    'sessions', (SELECT count(*) FROM therapy_sessions),
    'batches', (SELECT count(*) FROM stock_batches),
    'invoices', (SELECT json_agg(id ORDER BY patient_id) FROM invoices),
    'days', (SELECT json_agg(day_start ORDER BY day_start) FROM at14_days)
);
COMMIT;
