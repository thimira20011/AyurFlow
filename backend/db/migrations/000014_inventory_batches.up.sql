-- Migration 000014: botanical items and stock batches (TASK-INV-01)
-- Owner: Member D (K. I. R. Perera)  Reviewer: Member E
-- SRS: INV-01, INV-02, INV-03, INV-04, ADM-01, AUD-01
-- Depends on: 000001_foundation.up.sql (staff_accounts, audit_events)

CREATE TABLE botanical_items (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    code               text        NOT NULL UNIQUE
                                   CHECK (length(btrim(code)) > 0 AND length(code) <= 64 AND code = btrim(code)),
    display_name       text        NOT NULL
                                   CHECK (length(btrim(display_name)) > 0 AND length(display_name) <= 200),
    base_unit          text        NOT NULL DEFAULT 'g'
                                   CHECK (base_unit = 'g'),
    active             boolean     NOT NULL DEFAULT true,
    deactivated_reason text,
    deactivated_by     uuid        REFERENCES staff_accounts(id),
    deactivated_at     timestamptz,
    created_by         uuid        NOT NULL REFERENCES staff_accounts(id),
    created_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT botanical_items_deactivation_state CHECK (
        (active AND deactivated_reason IS NULL AND deactivated_by IS NULL AND deactivated_at IS NULL) OR
        (NOT active AND deactivated_reason IS NOT NULL AND length(btrim(deactivated_reason)) > 0 AND length(deactivated_reason) <= 500 AND deactivated_by IS NOT NULL AND deactivated_at IS NOT NULL)
    )
);

CREATE INDEX botanical_items_active_name_idx ON botanical_items (active, display_name ASC, id ASC);

CREATE TABLE stock_batches (
    id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         uuid           NOT NULL REFERENCES botanical_items(id) ON DELETE RESTRICT,
    batch_reference text           NOT NULL UNIQUE
                                   CHECK (length(btrim(batch_reference)) > 0 AND length(batch_reference) <= 128 AND batch_reference = btrim(batch_reference)),
    received_grams  numeric(12, 3) NOT NULL CHECK (received_grams > 0),
    remaining_grams numeric(12, 3) NOT NULL CHECK (remaining_grams >= 0 AND remaining_grams <= received_grams),
    expires_at      date,
    blocked         boolean        NOT NULL DEFAULT false,
    block_reason    text,
    blocked_by      uuid           REFERENCES staff_accounts(id),
    blocked_at      timestamptz,
    received_by     uuid           NOT NULL REFERENCES staff_accounts(id),
    received_at     timestamptz    NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT stock_batches_block_state CHECK (
        (NOT blocked AND block_reason IS NULL AND blocked_by IS NULL AND blocked_at IS NULL) OR
        (blocked AND block_reason IS NOT NULL AND length(btrim(block_reason)) > 0 AND length(block_reason) <= 500 AND blocked_by IS NOT NULL AND blocked_at IS NOT NULL)
    )
);

CREATE INDEX stock_batches_item_expiry_idx ON stock_batches (item_id, expires_at ASC, id ASC);
CREATE INDEX stock_batches_received_idx ON stock_batches (received_at DESC, id ASC);

-- ADM-01 & INV-04: Retain historical catalog and batch receipt records; prevent hard deletes
-- and prevent mutating immutable receipt fields or unblocking an already blocked batch.
CREATE FUNCTION enforce_inventory_batch_retention() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'inventory catalog and stock batch records cannot be deleted';
    END IF;

    IF TG_TABLE_NAME = 'botanical_items' AND TG_OP = 'UPDATE' THEN
        IF NEW.id <> OLD.id OR NEW.code <> OLD.code OR NEW.base_unit <> OLD.base_unit OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'botanical item identity and base unit are immutable';
        END IF;
        IF NOT OLD.active AND NEW.active THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'deactivated botanical items cannot be reactivated';
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'stock_batches' AND TG_OP = 'UPDATE' THEN
        IF NEW.id <> OLD.id OR NEW.item_id <> OLD.item_id OR NEW.batch_reference <> OLD.batch_reference OR
           NEW.received_grams <> OLD.received_grams OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
           NEW.received_by <> OLD.received_by OR NEW.received_at <> OLD.received_at THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'stock batch receipt attributes are immutable';
        END IF;
        IF OLD.blocked AND (NOT NEW.blocked OR NEW.block_reason <> OLD.block_reason OR NEW.blocked_by <> OLD.blocked_by OR NEW.blocked_at <> OLD.blocked_at) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'blocked stock batches cannot be unblocked or have their block record rewritten';
        END IF;
        IF NEW.remaining_grams > OLD.remaining_grams THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'stock batch remaining grams cannot be increased after receipt';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER botanical_items_retention_guard
BEFORE UPDATE OR DELETE ON botanical_items
FOR EACH ROW EXECUTE FUNCTION enforce_inventory_batch_retention();

CREATE TRIGGER stock_batches_retention_guard
BEFORE UPDATE OR DELETE ON stock_batches
FOR EACH ROW EXECUTE FUNCTION enforce_inventory_batch_retention();

REVOKE ALL ON botanical_items, stock_batches FROM PUBLIC;
