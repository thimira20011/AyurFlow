-- Run with psql -v ON_ERROR_STOP=1 -v app_role=ayurflow_app -v schema=public
-- as the migration owner, AFTER migrations and BEFORE starting the API.
-- Roles/schema must already exist; this script never sets passwords.
BEGIN;
REVOKE ALL ON SCHEMA :"schema" FROM PUBLIC;
GRANT USAGE ON SCHEMA :"schema" TO :"app_role";
REVOKE ALL ON ALL TABLES IN SCHEMA :"schema" FROM :"app_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA :"schema" FROM :"app_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON
    :"schema".staff_accounts, :"schema".staff_roles,
    :"schema".staff_sessions, :"schema".auth_login_attempts,
    :"schema".patients, :"schema".patient_identities,
    :"schema".consultations, :"schema".consultation_addenda,
    :"schema".invoices, :"schema".invoice_items, :"schema".receipts
TO :"app_role";
GRANT SELECT ON :"schema".roles TO :"app_role";
GRANT SELECT, INSERT ON :"schema".audit_events TO :"app_role";
GRANT USAGE ON SEQUENCE :"schema".audit_events_id_seq TO :"app_role";
-- No schema_migrations, DDL, TRUNCATE, ownership or automatic future-table grants.
COMMIT;
