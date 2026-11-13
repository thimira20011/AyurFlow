# Billing manual acceptance walkthrough

Member E owns BILL-01–06. Member D reviews. This walkthrough supports AT12 and the billing contribution to QA-02 and OPS-03. Use synthetic data and an isolated development database.

## Start a test instance

Use an HTTPS synthetic instance built from this checkout with migration `000017_invoice_patient_reference.up.sql` applied. You need separate receptionist, billing, report-reader and administrator-only accounts. See the [operator setup](../../deploy/README.md) and the [synthetic seed instructions](../../backend/db/seeds/README.md).

If the manual instance prepared for this review is running, open [localhost:3445](https://localhost:3445/sign-in) and use the account names and password in `.cache/member-e-manual/fixture.json`. This instance uses a self-signed local certificate and a separate, fresh database. Start the walkthrough at step 1.

For a local session, follow the [full-stack fixture setup](../../frontend/tests/fullstack/README.md) through the frontend build. Use a fresh empty `ayurflow_auth_e2e` database. From the repository root, start the fixture directly with `node frontend/tests/fullstack/start.mjs` and leave that terminal open. Sign in at [localhost:3443](https://localhost:3443) using the account names and password in the private, ignored `.cache/auth-e2e/fixture.json`. Use a fresh database for each fixture start. The default automated-test session expires after 20 seconds idle or 60 seconds total, so sign in again if it expires during the walkthrough.

## Run the checks

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Sign in as reception. Register a synthetic patient and copy the displayed `AYUR-PT-…` code. | The patient appears in search with the same code. |
| 2 | Sign in as billing. Open **Invoices**, then **Open Draft Invoice**. Enter an unused registry code, then use the real synthetic code. | The unused code shows a patient-not-found message. The registered code opens one draft linked to the patient. |
| 3 | Add a treatment line priced at LKR 10,000.25. Add and remove a second line. Issue the invoice. | The total is LKR 10,000.25. The invoice is issued and line-edit controls disappear. |
| 4 | Open **Outstanding Aging Report**. | The new invoice appears with LKR 10,000.25 outstanding. |
| 5 | Open the invoice and choose **Record Payment**. Select **Direct Deposit**, enter LKR 4,000.10 and reference `Synthetic deposit E05`. | Receipt history shows one labelled deposit. Outstanding is LKR 6,000.15. |
| 6 | Reload the browser, use the same patient code to reload invoices, then reopen the invoice. Try a payment of LKR 6,000.16. | One receipt still appears and the balance is unchanged. The overpayment is rejected. |
| 7 | Sign in as a report reader in a separate browser profile. Open **Outstanding invoices** from the staff workspace. | The invoice shows LKR 6,000.15 outstanding. Invoice editing and payment controls are absent. |
| 8 | As billing, record the remaining LKR 6,000.15 in cash. Refresh the report in both profiles. | The invoice balance is zero, both receipts remain in its history, and the settled invoice disappears from the report. |
| 9 | As administrator-only, open `/billing` directly. | The billing page denies access. |

If a receipt request loses its response, click **Retry Receipt** in the same open payment form. It resends the same operation. If the page was reloaded, inspect the existing receipt history before attempting another payment.

Record date, tester, commit, browser, database environment, actual result and any defect for each step. Record only synthetic screenshots and keep credentials out of evidence. Member D review and DEC04 clinic approval are required for formal AT12 acceptance.

## Automated checks

From `backend/`, set `TEST_DATABASE_URL` to a disposable database and run `go test -tags=integration -count=1 ./internal/billing ./internal/transport/http`. From `frontend/`, run `npm run test:browser -- billing.spec.ts` after building the frontend, and `npm run test:fullstack -- member-e.spec.ts` with the separate full-stack fixture.
