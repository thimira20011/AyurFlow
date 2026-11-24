# Scheduling module

Owner: Member C. Reviewer: Member B. SRS: `SCH-01`–`06`.

Migration `000015_scheduling.up.sql` creates rooms, resource availability and therapy sessions. Separate PostgreSQL exclusion constraints prevent overlapping room and therapist bookings; intervals are half-open. The service and protected HTTP routes support room creation, availability, booking, optimistic-version rescheduling, cancellation, therapist start and completion. Booking and session start check the current care-plan stage; hold and cancellation retain delivery history. Plan completion checks outstanding sessions, and plan cancellation cancels future unstarted bookings in the same transaction.

`service_integration_test.go` exercises booking races, role access, availability changes that preserve booked coverage, rescheduling rollback, clearance and hold/cancel behavior against PostgreSQL. Member B/C review and recorded scheduling acceptance evidence are required for formal closure.

`booking_resources_integration_test.go` independently checks concurrent room-only and therapist-only conflicts, simultaneous bookings with separate resources, and adjacent intervals in both directions. It verifies saved booking payloads and matching audit events, including the absence of a losing booking's audit. See [setup and expected outcomes](../../../docs/evidence/member-c-booking-resources-2026-11-12.md). This is a SCH-06 contribution supporting AT06; parent task acceptance and B review remain open.

`reschedule_integrity_integration_test.go` checks successful allocation/version updates, independent room/therapist conflicts, unavailable slots and controlled same-version reschedules. Rejected edits retain the full database row; concurrent edits produce one committed allocation/version increment and one matching audit. Existing QA04 tests cover audit-write rollback. See [setup and results](../../../docs/evidence/member-c-reschedule-integrity-2026-11-24.md). SCH-03/SCH-06 and B acceptance remain open.
