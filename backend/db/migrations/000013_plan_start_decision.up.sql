-- TASK-CLN-01: make NOT_STARTED -> PREPARATORY an explicit, audited transition.
ALTER TABLE plan_decisions DROP CONSTRAINT plan_decisions_action_check;
ALTER TABLE plan_decisions ADD CONSTRAINT plan_decisions_action_check
    CHECK (action IN ('start', 'approve', 'advance', 'hold', 'resume', 'cancel', 'complete'));
