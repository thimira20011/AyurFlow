# Scheduling interface

`/scheduling` uses the shared staff shell and live `/api/v1` scheduling routes. Reception can create rooms, create/change availability, book, reschedule and cancel sessions. Availability changes preserve booked coverage. Assigned therapists can start sessions and record delivery observations. Clinicians can see sessions for assigned patients. The screen displays Asia/Colombo times and uses the existing Figma-inspired form, table, badge and error styles. The backend remains authoritative for role, record and clinical-clearance rules.

Staff must supply valid patient, plan, stage and therapist IDs for new bookings. A richer patient/plan picker remains follow-up UI work; this screen does not claim final `AT06`–`AT07` acceptance.
