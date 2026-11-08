# Scheduling module

Owner: Member C. Reviewer: Member B. SRS: `SCH-01`–`06`.

Migration `000015_scheduling.up.sql` creates rooms, resource availability and therapy sessions. Separate PostgreSQL exclusion constraints prevent overlapping room and therapist bookings; intervals are half-open. The service and protected HTTP routes support room creation, availability, booking, optimistic-version rescheduling, cancellation, therapist start and completion. Booking and session start check the current care-plan stage; hold and cancellation retain delivery history. Plan completion checks outstanding sessions, and plan cancellation cancels future unstarted bookings in the same transaction.

`service_integration_test.go` exercises booking races, role access, availability changes that preserve booked coverage, rescheduling rollback, clearance and hold/cancel behavior against PostgreSQL. Member B/C review and recorded scheduling acceptance evidence are required for formal closure.
