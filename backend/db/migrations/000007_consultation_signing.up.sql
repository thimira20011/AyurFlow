-- TASK-CON-02. Keep the original signed text separate from editable drafts.
-- A must confirm this migration number before integration.
ALTER TABLE consultations DROP CONSTRAINT consultations_draft_only;
ALTER TABLE consultations ALTER COLUMN draft_text DROP NOT NULL;
ALTER TABLE consultations ADD COLUMN signed_text text;
ALTER TABLE consultations ADD COLUMN signed_by uuid REFERENCES staff_accounts(id);
ALTER TABLE consultations ADD COLUMN signed_at timestamptz;
ALTER TABLE consultations ADD CONSTRAINT consultations_signing_state CHECK (
    (status = 'draft' AND draft_text IS NOT NULL AND signed_text IS NULL
        AND signed_by IS NULL AND signed_at IS NULL)
    OR
    (status = 'signed' AND draft_text IS NULL AND signed_text IS NOT NULL
        AND signed_by IS NOT NULL AND signed_at IS NOT NULL)
);
ALTER TABLE consultations ADD CONSTRAINT consultations_signed_text_valid CHECK (
    signed_text IS NULL OR (length(btrim(signed_text)) > 0 AND octet_length(signed_text) <= 65536)
);

CREATE TABLE consultation_addenda (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id uuid NOT NULL REFERENCES consultations(id),
    author_id uuid NOT NULL REFERENCES staff_accounts(id),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    reason text NOT NULL CHECK (length(btrim(reason)) > 0 AND octet_length(reason) <= 2048),
    body text NOT NULL CHECK (length(btrim(body)) > 0 AND octet_length(body) <= 65536)
);
CREATE INDEX consultation_addenda_history_idx
    ON consultation_addenda (consultation_id, created_at, id);

CREATE FUNCTION reject_signed_consultation_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' OR OLD.status = 'signed' THEN
        RAISE EXCEPTION 'consultation deletion or signed change is forbidden';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER consultations_signed_immutable
    BEFORE UPDATE OR DELETE ON consultations
    FOR EACH ROW EXECUTE FUNCTION reject_signed_consultation_change();

CREATE FUNCTION guard_consultation_addendum() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE consultation_status text;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'consultation addendum is immutable';
    END IF;
    SELECT status INTO consultation_status FROM consultations
        WHERE id = NEW.consultation_id FOR SHARE;
    IF consultation_status IS DISTINCT FROM 'signed' THEN
        RAISE EXCEPTION 'addendum requires a signed consultation';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER consultation_addenda_insert_guard
    BEFORE INSERT ON consultation_addenda
    FOR EACH ROW EXECUTE FUNCTION guard_consultation_addendum();
CREATE TRIGGER consultation_addenda_immutable
    BEFORE UPDATE OR DELETE ON consultation_addenda
    FOR EACH ROW EXECUTE FUNCTION guard_consultation_addendum();

CREATE FUNCTION reject_consultation_history_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'consultation history is immutable';
END $$;
CREATE TRIGGER consultations_no_truncate BEFORE TRUNCATE ON consultations
    FOR EACH STATEMENT EXECUTE FUNCTION reject_consultation_history_truncate();
CREATE TRIGGER consultation_addenda_no_truncate BEFORE TRUNCATE ON consultation_addenda
    FOR EACH STATEMENT EXECUTE FUNCTION reject_consultation_history_truncate();
