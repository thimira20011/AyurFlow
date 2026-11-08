-- TASK-SCH-01–04. Half-open room and therapist bookings retain their history.
CREATE TABLE clinic_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE CHECK (length(btrim(code)) BETWEEN 1 AND 64),
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
    active boolean NOT NULL DEFAULT true,
    created_by uuid NOT NULL REFERENCES staff_accounts(id),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE resource_availability (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid REFERENCES clinic_rooms(id),
    therapist_id uuid REFERENCES staff_accounts(id),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    created_by uuid NOT NULL REFERENCES staff_accounts(id),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK ((room_id IS NULL) <> (therapist_id IS NULL)),
    CHECK (ends_at > starts_at)
);
CREATE INDEX resource_availability_room_idx ON resource_availability(room_id, starts_at, ends_at);
CREATE INDEX resource_availability_therapist_idx ON resource_availability(therapist_id, starts_at, ends_at);

ALTER TABLE care_plans ADD CONSTRAINT care_plans_id_patient_unique UNIQUE (id, patient_id);

CREATE TABLE therapy_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patients(id),
    plan_id uuid NOT NULL,
    stage_id uuid NOT NULL,
    room_id uuid NOT NULL REFERENCES clinic_rooms(id),
    therapist_id uuid NOT NULL REFERENCES staff_accounts(id),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','in_progress','completed','cancelled')),
    observations text,
    cancellation_reason text,
    started_at timestamptz,
    completed_at timestamptz,
    cancelled_at timestamptz,
    record_version bigint NOT NULL DEFAULT 1,
    created_by uuid NOT NULL REFERENCES staff_accounts(id),
    updated_by uuid NOT NULL REFERENCES staff_accounts(id),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY (plan_id, patient_id) REFERENCES care_plans(id, patient_id),
    FOREIGN KEY (stage_id, plan_id) REFERENCES plan_stages(id, plan_id),
    CHECK (ends_at > starts_at),
    CHECK (record_version > 0),
    CHECK ((status = 'booked' AND started_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL) OR
           (status = 'in_progress' AND started_at IS NOT NULL AND completed_at IS NULL AND cancelled_at IS NULL) OR
           (status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND cancelled_at IS NULL) OR
           (status = 'cancelled' AND started_at IS NULL AND completed_at IS NULL AND cancelled_at IS NOT NULL AND length(btrim(cancellation_reason)) > 0))
);
ALTER TABLE therapy_sessions ADD CONSTRAINT therapy_sessions_room_overlap
    EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
    WHERE (status IN ('booked','in_progress'));
ALTER TABLE therapy_sessions ADD CONSTRAINT therapy_sessions_therapist_overlap
    EXCLUDE USING gist (therapist_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
    WHERE (status IN ('booked','in_progress'));
CREATE INDEX therapy_sessions_patient_idx ON therapy_sessions(patient_id, starts_at DESC, id);
CREATE INDEX therapy_sessions_therapist_idx ON therapy_sessions(therapist_id, starts_at, id);

CREATE FUNCTION protect_therapy_session_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'therapy session history cannot be deleted';
    END IF;
    IF OLD.status IN ('completed','cancelled') OR
       NEW.patient_id <> OLD.patient_id OR NEW.plan_id <> OLD.plan_id OR NEW.stage_id <> OLD.stage_id OR
       NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at OR
       (OLD.status = 'in_progress' AND (NEW.starts_at <> OLD.starts_at OR NEW.ends_at <> OLD.ends_at OR
        NEW.room_id <> OLD.room_id OR NEW.therapist_id <> OLD.therapist_id)) THEN
        RAISE EXCEPTION 'therapy session history is immutable';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER therapy_session_history_guard BEFORE UPDATE OR DELETE ON therapy_sessions
    FOR EACH ROW EXECUTE FUNCTION protect_therapy_session_history();
