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
