# Billing interface

`/billing` uses the shared staff shell and the protected Go API to load a patient's invoices, edit draft
lines, issue the invoice, and record cash or a labelled direct deposit. The
invoice list and detail use receipt history keyed by invoice. Totals cover the
loaded invoice list, and a failed receipt-history lookup shows an unavailable
balance. The Go service remains authoritative for permissions, locking and
overpayment checks.

Payment inputs accept up to two decimal places and send integer LKR minor
units. If a payment response is lost, **Retry Receipt** resends the original
amount, method, reference and operation ID in the same open workspace. If the
page was closed or reloaded before confirmation, inspect the invoice's receipt
history before starting another payment.

`tests/browser/billing.spec.ts` exercises retry and reload with synthetic API
responses. `tests/fullstack/member-e.spec.ts` exercises draft, issue, deposit
and reload against the disposable Go/PostgreSQL browser fixture. See
`tests/fullstack/README.md` for setup.

## TASK-QA-02 report navigation (Member F)

The shared billing entry permits `billing` and `report_reader`. Report readers have a
Billing reports workspace with an Outstanding invoices link, including on multi-role
accounts. The existing billing component restricts report-only users to the report;
invoice creation, issue and receipt mutations retain their existing billing-only
checks. Reception access is unchanged. Backend role checks remain authoritative.

This matches E's existing `OutstandingReport` service permission (`billing` or
`report_reader`); F has not changed backend permissions. A/E peer review remains
pending before marking the QA-02 slice accepted. Full report-category/filter/export
acceptance is outside this navigation fix.
