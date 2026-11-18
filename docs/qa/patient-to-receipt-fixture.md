# QA-01 patient-to-receipt fixture

Member F assembles the fixture. Member A reviews it, and Members B–E own their module steps. The data supports the shared journey across AT02–AT13 using the current provisional rules in [DEC02, DEC03, DEC04, and DEC08](../decisions.md). It is synthetic test input and expected results. Run and record the live journey separately under TASK-QA-03.

Use the [JSON manifest](../../tests/fixtures/patient-to-receipt.json) from any test runner or load the resolved records in Node:

```js
import { loadPatientToReceipt } from "./tests/fixtures/patient-to-receipt.mjs";

const { patient, plan, session, preparation, invoice, receipts, expected } = loadPatientToReceipt();
```

The loader resolves Member B's [patient, pathway, and therapist](../../tests/fixtures/member-b-cases.json) and Member D's [recipe, preparation, batches, and allocations](../../tests/fixtures/member-d-cases.json). Each call returns fresh data. Fixture IDs identify records in the dataset. In an API test, keep a map from these keys to the IDs returned by the server, and translate each reference before submitting the next request. In particular, the booking uses the returned stage UUID for ordinal 1, preparation uses the returned session and recipe UUIDs, and each receipt uses the issued invoice UUID. Fixture bookkeeping and expected-result fields are not API fields. The invoice shares the patient with the clinical journey. Billing links the receipt to the invoice and has no direct session or preparation reference.

| Order | Staff and fixture setup | Expected checkpoint |
| --- | --- | --- |
| 1 | Reception registers `b-no-identity`. Administration assigns the clinician. That clinician saves and signs `f-consultation-01`, starts the Preparatory stage of `f-plan-01`, and completes its required approval evidence. | The plan is active and its current first stage is approved before booking. |
| 2 | Reception creates `f-room-01`, records both availability windows, then books `c-session-01` for the patient, current stage, room, and assigned therapist. The therapist starts and completes it with the fixture observations. | Both windows cover the slot. Session status progresses from booked to in progress to completed. Leave the plan active and the stage approved for preparation setup. |
| 3 | Dispensary creates the botanical items, receives the three batches, and creates the recipe with the supplied `recipe.code` and resolved ingredient IDs. Save `d-prep-srs-scale` using that recipe, the same patient and session, and the target yield. | The snapshot asks for **50.000 g** Ashwagandha and **37.500 g** Guduchi. Saving it leaves stock unchanged and creates no actual consumption. |
| 4 | Dispensary confirms consumption using the three allocations. Reuse the same operation ID and body for a retry. | Remaining stock is **970.000 g**, **480.000 g**, and **362.500 g** for the listed batches. A retry does not deduct stock twice. Traceability uses the same patient, session, preparation, and batch IDs. |
| 5 | Billing opens `f-invoice-01` for the same patient, adds the treatment item, issues the invoice, and posts the labelled direct-deposit receipt. | Issued total is **LKR 10,000.25**, paid is **LKR 4,000.10**, and outstanding is **LKR 6,000.15**. An identical receipt retry returns the original receipt and keeps the same balance. |

The schedule is expressed in UTC and anchored to the reference clinic date in Asia/Colombo. For a live run on another date, place both availability windows and the slot on the same clinic day, preserving their relative times. Choose expiry dates after that run's Colombo clinic date for the three eligible batches. Use a fresh disposable database, or namespace unique codes and references and generate separate operation IDs per run. Reuse each run's operation ID only for a retry of the same request.

From the repository root, run `node --test frontend/tests/patient-to-receipt-fixture.test.mjs`. The frontend `npm test` command also includes these checks. They verify reference integrity, booking-window coverage, fixed-precision stock arithmetic, and invoice/receipt totals. For live work, use the [disposable full-stack harness](../../frontend/tests/fullstack/README.md) and record the QA-03 result in [testing.md](../testing.md).
