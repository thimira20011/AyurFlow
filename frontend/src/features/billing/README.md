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
