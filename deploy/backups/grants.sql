-- Apply as the migration owner after the DBA creates ayurflow_backup.
-- The backup role is a maintenance connection with read access across modules.
BEGIN;
GRANT USAGE ON SCHEMA public TO ayurflow_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ayurflow_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ayurflow_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ayurflow_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO ayurflow_backup;
COMMIT;
