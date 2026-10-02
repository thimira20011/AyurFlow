# Operations starter runbook

Development startup is documented in the root README. `docker compose stop` then `docker compose up -d` preserves the database volume. Use `docker compose logs` and the API health/readiness endpoints to diagnose availability without exposing passwords or records in shared logs. `docker compose down -v` destroys local data and is not a normal restart operation.

The migration container applies numbered SQL before the API starts. After adding migrations run `docker compose up --build -d` and check the migration job's exit status. Never edit previously applied files. Review backup/restore before schema changes.

For the pilot, finish and review HTTPS configuration from `deploy/Caddyfile.example`, select/pin a Caddy image, connect it to the application network, restrict database exposure, create a restricted application database role separate from the migration operator, manage secrets and confirm DEC05-06. The development Compose file uses the database owner for bootstrap convenience and is not the production access model.

Before adding sign-in, implement Argon2id, opaque server-side session cookies (Secure, HttpOnly and appropriate SameSite), CSRF, expiry, revocation and backend role/record checks. Real-data use requires separately recorded authorization.

## Backup/restore work still required

Agree daily encrypted backups to storage separate from the host, a separate key custodian, monitoring and a restore operator. Implement and demonstrate these rather than treating a local SQL dump as an accepted backup process. In an isolated environment, restore and inspect one patient, batch, invoice and audit event; record backup age, restore duration and result. Backup automation is not configured by this scaffold.

During an outage use the clinic-approved paper workflow, then re-enter through normal validated/audited forms with the original event reference where supported. No offline synchronization is planned. Role guides, production configuration and a named support/handover contact remain delivery tasks.
