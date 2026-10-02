# Proposed ownership and delivery

Derived from the supplied team task plan dated 1 October 2026. Slots A-F are not named-member assignments.

| Slot | Primary work | Reviewer |
| --- | --- | --- |
| A | Shared Go/API, authentication, RBAC, audit, deployment and backups | F |
| B | Patients, consultations, clinical pathway and clinician decisions | C |
| C | Rooms, availability, scheduling and therapist delivery | B |
| D | Botanical inventory, recipes, preparation, consumption and traceability | E |
| E | Invoices, receipts, balances and billing reports | D |
| F | Shared frontend, workflow integration, UAT and guides | A |

Each owner delivers migrations, behavior, screens, permission/audit checks and tests. F supports patterns and integration rather than owning all screens/testing.

| Sprint | Weeks | Exit check |
| --- | --- | --- |
| 1 | 1-2 | Reviewed decisions/contracts and deployed login → registration → search with permissions |
| 2 | 3-4 | Consultation → approved plan → conflict-safe booking → authorized session start |
| 3 | 5-6 | Full synthetic patient-to-receipt journey, stock/receipt rollback and retry; feature freeze |
| 4 | 7-8 | Clinic UAT, load/concurrency/usability evidence, isolated restore and serious defect fixes |
| 5 | 9-10 | Contingency, clean deployment, training and reviewed handover |

Scaffold creation supports TASK-SET-05 and establishes a starting point for TASK-SET-06. Neither task is complete until contracts are reviewed and every team member can start the application. All feature tasks and AT01-AT17 remain pending.
