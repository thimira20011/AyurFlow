-- Only structured metadata belongs here. Detailed clinical/business text stays
-- in its protected source record, referenced by object_type and object_id.
ALTER TABLE audit_events
    ADD COLUMN changed_fields text[] NOT NULL DEFAULT '{}',
    ALTER COLUMN occurred_at SET DEFAULT clock_timestamp(),
    ADD CONSTRAINT audit_action_code CHECK (
        length(action) <= 96 AND action ~ '^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*)+$'
    ),
    ADD CONSTRAINT audit_object_type_code CHECK (object_type ~ '^[a-z][a-z0-9_]{0,63}$'),
    ADD CONSTRAINT audit_object_id_code CHECK (object_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
    ADD CONSTRAINT audit_reason_code CHECK (reason IS NULL OR reason ~ '^[a-z][a-z0-9_]{0,63}$');

CREATE FUNCTION audit_valid_changed_fields(fields text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT cardinality(fields) <= 32 AND NOT EXISTS (
        SELECT 1 FROM unnest(fields) AS field
        WHERE field IS NULL OR field !~ '^[a-z][a-z0-9_]{0,63}$'
    )
$$;

ALTER TABLE audit_events ADD CONSTRAINT audit_changed_field_codes
    CHECK (audit_valid_changed_fields(changed_fields));

CREATE FUNCTION reject_audit_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'audit events are append-only';
END;
$$;

CREATE TRIGGER audit_events_no_update_delete
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_changes();

CREATE TRIGGER audit_events_no_truncate
BEFORE TRUNCATE ON audit_events
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_changes();

REVOKE ALL ON audit_events FROM PUBLIC;
CREATE INDEX audit_events_object_cursor_idx ON audit_events(object_type, object_id, id DESC);
