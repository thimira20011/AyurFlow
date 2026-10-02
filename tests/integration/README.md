# PostgreSQL integration tests

Add real PostgreSQL tests as module transactions are implemented. Required cases include two conflicting bookings (room and therapist separately), adjacent intervals, failed rescheduling retaining the original, hold/start races, multi-batch rollback, consumption retries, competing stock confirmations, receipt races and rollback if an audit insert fails.

Use an isolated synthetic test database. A mock repository is not acceptance evidence for database constraints or row-lock concurrency. These scenarios are pending; no acceptance result is claimed by this scaffold.
