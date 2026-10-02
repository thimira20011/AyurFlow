# Database foundation

Run `go run ./cmd/migrate` from `backend/` with `DATABASE_URL` set. Forward migrations are embedded in the executable, applied in filename order, recorded in `schema_migrations`, and protected by a transaction-level advisory lock. The pending batch runs in one transaction. Run migrations explicitly before starting the API.

Use six-digit sequential filenames: `000003_patients.up.sql`. Coordinate numbers across owners and never edit an applied migration. Review backup/restore before destructive changes; there is deliberately no automatic down migration.

The initial schema contains identity, role, server-session and audit storage. It does not implement authentication, audit immutability or permissions. No staff accounts or credentials are seeded. `btree_gist` is enabled for future scheduling exclusion constraints.

Clinical, patient, scheduling, stock and invoice schemas remain pending agreed field rules. Use `timestamptz` for event times, PostgreSQL `date` for expiry, integer minor units for LKR, and `numeric` with an agreed decimal scale for grams. Enforce half-open booking intervals and uniqueness for retries in their module migrations.
