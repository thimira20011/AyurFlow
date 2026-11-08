# Reception overview

Member B's `member-b/reception-live-entry` slice of TASK-UI-01 uses the shared Living Heritage shell. The **Register patient** links open `/patients?action=register`, and search links open `/patients`; registration and identity checks are performed by the protected patient workspace and Go API. The reception page has no local patient mutation or browser-memory appointment list.

Scheduling has no connected frontend service here. The overview states that session counts, arrivals and room use are unavailable instead of displaying synthetic figures or a misleading zero. Booking and check-in belong to TASK-SCH-05. At 1024×768, the two panels stack without horizontal overflow.
