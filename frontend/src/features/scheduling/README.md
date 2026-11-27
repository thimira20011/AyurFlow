# Scheduling interface

`/scheduling` uses the shared staff shell and live `/api/v1` scheduling routes. Reception can create rooms, create/change availability, book, reschedule and cancel sessions. Availability changes preserve booked coverage. Assigned therapists can start sessions and record delivery observations. Clinicians can see sessions for assigned patients. The screen displays Asia/Colombo times and uses the existing Figma-inspired form, table, badge and error styles. The backend remains authoritative for role, record and clinical-clearance rules.

Staff must supply valid patient, plan, stage and therapist IDs for new bookings. A richer patient/plan picker remains follow-up UI work; this screen does not claim final `AT06`–`AT07` acceptance.

Loading, empty and failed-date states follow the [Member C recovery designs](https://www.figma.com/design/z0du8yEIF8zoZfemfhbIzo/?node-id=181-644). All three reads must succeed for the selected Asia/Colombo date before mutation controls are enabled. Obsolete reads are aborted and ignored; prior session/availability lists are hidden during loading or failure. Retry retains entered values and performs reads only. Unknown write outcomes and failed post-write refreshes require a successful reload before another change. See [behavior and verification](../../../../docs/evidence/member-c-scheduling-recovery-ui-2026-11-27.md).
