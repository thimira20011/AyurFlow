# Contributing

Use small reviewed changes and one accountable owner per task. A-F are proposed ownership slots, not confirmed assignments to named students. Default branch names use `codex/` for agent-created branches.

For a feature, update its Go handler/service/repository, migration, OpenAPI contract, frontend integration and meaningful tests together. Coordinate migration numbers and shared contracts before changing them. Use parameterized SQL and keep critical business changes and their audit insert in the same transaction.

Protected endpoints must enforce backend role and record permissions. Administrator alone is not clinical permission. Add CSRF and opaque server-side session checks before enabling staff mutation routes. Never log note bodies, passwords, cookies or session tokens.

Use synthetic fixtures. Run relevant checks before review; record failed acceptance cases honestly. Booking/stock/receipt concurrency requires real PostgreSQL evidence. Do not add gateways, FEFO, reservations, refunds, recursive recipes, multi-clinic tenancy or offline synchronization to this baseline.
