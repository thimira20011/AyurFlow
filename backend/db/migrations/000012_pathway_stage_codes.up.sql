-- TASK-CLN-01: the three treatment stages in the user-supplied DEC02 sequence.
-- Draft/active/completed plan status supplies NOT_STARTED and COMPLETED.
ALTER TABLE plan_stages ADD COLUMN stage_code text;
ALTER TABLE plan_stages ADD COLUMN confirmed_checks text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE plan_stages ADD CONSTRAINT plan_stages_code_ordinal CHECK (
    stage_code IS NULL OR
    (ordinal=1 AND stage_code='PREPARATORY') OR
    (ordinal=2 AND stage_code='PRIMARY') OR
    (ordinal=3 AND stage_code='RECOVERY')
) NOT VALID;
CREATE UNIQUE INDEX plan_stages_plan_code_unique ON plan_stages(plan_id, stage_code)
    WHERE stage_code IS NOT NULL;

-- Terminal plans retain stage and decision history even if a future caller
-- bypasses the service. Lock the parent first, matching the session-start order.
CREATE FUNCTION reject_terminal_plan_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE plan_status text;
DECLARE target_plan uuid;
BEGIN
    IF TG_TABLE_NAME = 'care_plans' THEN
        IF OLD.status IN ('completed', 'cancelled') THEN
            RAISE EXCEPTION 'terminal care plans are immutable';
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN target_plan := OLD.plan_id;
    ELSE target_plan := NEW.plan_id; END IF;
    SELECT status INTO plan_status FROM care_plans
        WHERE id = target_plan FOR UPDATE;
    IF plan_status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'terminal care plan stages are immutable';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER care_plans_terminal_immutable BEFORE UPDATE OR DELETE ON care_plans
    FOR EACH ROW EXECUTE FUNCTION reject_terminal_plan_change();
CREATE TRIGGER plan_stages_terminal_immutable BEFORE INSERT OR UPDATE OR DELETE ON plan_stages
    FOR EACH ROW EXECUTE FUNCTION reject_terminal_plan_change();
