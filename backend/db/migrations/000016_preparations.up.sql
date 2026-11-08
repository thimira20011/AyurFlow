-- TASK-INV-02–06. Flat recipes, immutable preparation snapshots, and actual consumption.
CREATE TABLE recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE CHECK (length(btrim(code)) BETWEEN 2 AND 64),
    display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 200),
    base_yield_grams numeric(12,3) NOT NULL CHECK (base_yield_grams > 0),
    active boolean NOT NULL DEFAULT true,
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    created_by uuid NOT NULL REFERENCES staff_accounts(id),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE recipe_ingredients (
    recipe_id uuid NOT NULL REFERENCES recipes(id),
    item_id uuid NOT NULL REFERENCES botanical_items(id),
    quantity_grams numeric(12,3) NOT NULL CHECK (quantity_grams > 0),
    PRIMARY KEY (recipe_id, item_id)
);
ALTER TABLE therapy_sessions ADD CONSTRAINT therapy_sessions_id_patient_unique UNIQUE (id, patient_id);
CREATE TABLE preparations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patients(id),
    session_id uuid NOT NULL,
    recipe_id uuid NOT NULL REFERENCES recipes(id),
    recipe_version bigint NOT NULL CHECK (recipe_version > 0),
    target_yield_grams numeric(12,3) NOT NULL CHECK (target_yield_grams > 0),
    status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','consumed')),
    prepared_by uuid NOT NULL REFERENCES staff_accounts(id),
    prepared_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    consumed_by uuid REFERENCES staff_accounts(id),
    consumed_at timestamptz,
    operation_id uuid UNIQUE,
    FOREIGN KEY (session_id, patient_id) REFERENCES therapy_sessions(id, patient_id),
    CHECK ((status='prepared' AND consumed_by IS NULL AND consumed_at IS NULL AND operation_id IS NULL) OR
           (status='consumed' AND consumed_by IS NOT NULL AND consumed_at IS NOT NULL AND operation_id IS NOT NULL))
);
CREATE INDEX preparations_patient_idx ON preparations(patient_id, prepared_at DESC, id);
CREATE TABLE preparation_snapshot_items (
    preparation_id uuid NOT NULL REFERENCES preparations(id),
    item_id uuid NOT NULL REFERENCES botanical_items(id),
    item_code text NOT NULL,
    item_display_name text NOT NULL,
    base_quantity_grams numeric(12,3) NOT NULL CHECK (base_quantity_grams > 0),
    required_grams numeric(12,3) NOT NULL CHECK (required_grams > 0),
    PRIMARY KEY (preparation_id, item_id)
);
CREATE TABLE batch_consumptions (
    preparation_id uuid NOT NULL REFERENCES preparations(id),
    batch_id uuid NOT NULL REFERENCES stock_batches(id),
    item_id uuid NOT NULL REFERENCES botanical_items(id),
    quantity_grams numeric(12,3) NOT NULL CHECK (quantity_grams > 0),
    confirmed_by uuid NOT NULL REFERENCES staff_accounts(id),
    confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    operation_id uuid NOT NULL,
    PRIMARY KEY (preparation_id, batch_id)
);
CREATE INDEX batch_consumptions_batch_idx ON batch_consumptions(batch_id, confirmed_at);
CREATE TABLE consumption_operations (
    operation_id uuid PRIMARY KEY,
    preparation_id uuid NOT NULL REFERENCES preparations(id),
    payload_sha256 text NOT NULL CHECK (length(payload_sha256) = 64),
    confirmed_by uuid NOT NULL REFERENCES staff_accounts(id),
    confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION protect_preparation_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' OR TG_TABLE_NAME IN ('preparation_snapshot_items','batch_consumptions','consumption_operations') THEN
        RAISE EXCEPTION 'preparation history is append-only';
    END IF;
    IF OLD.status='consumed' OR NEW.id<>OLD.id OR NEW.patient_id<>OLD.patient_id OR
       NEW.session_id<>OLD.session_id OR NEW.recipe_id<>OLD.recipe_id OR
       NEW.recipe_version<>OLD.recipe_version OR NEW.target_yield_grams<>OLD.target_yield_grams OR
       NEW.prepared_by<>OLD.prepared_by OR NEW.prepared_at<>OLD.prepared_at OR
       (NEW.status<>'consumed' AND NEW.status<>OLD.status) THEN
        RAISE EXCEPTION 'preparation identity and confirmed history are immutable';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER preparations_history_guard BEFORE UPDATE OR DELETE ON preparations
    FOR EACH ROW EXECUTE FUNCTION protect_preparation_history();
CREATE TRIGGER preparation_snapshot_history_guard BEFORE UPDATE OR DELETE ON preparation_snapshot_items
    FOR EACH ROW EXECUTE FUNCTION protect_preparation_history();
CREATE TRIGGER batch_consumptions_history_guard BEFORE UPDATE OR DELETE ON batch_consumptions
    FOR EACH ROW EXECUTE FUNCTION protect_preparation_history();
CREATE TRIGGER consumption_operations_history_guard BEFORE UPDATE OR DELETE ON consumption_operations
    FOR EACH ROW EXECUTE FUNCTION protect_preparation_history();

REVOKE ALL ON recipes, recipe_ingredients, preparations, preparation_snapshot_items,
    batch_consumptions, consumption_operations FROM PUBLIC;
