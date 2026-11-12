# Shared staff UI patterns

`TASK-UI-06` · Owner: Member F · Reviewer: Member A · Supports AT15 (keyboard, labels, errors and viewport usability). Builds on the [shared staff workspace](shared-workspace-implementation.md) and its Living Heritage tokens. These frontend patterns leave each module in charge of its domain rules, API messages, permissions and retry behavior.

| Need | Use | Example in the app |
| --- | --- | --- |
| Label, help and inline validation | `Field` connects the label and descriptions to one native control; sets `aria-invalid` only while the error is present. Keep browser constraints such as `required`. | Booking end time; draft invoice patient ID |
| Action feedback | `Notice tone="error"` for failures that need attention; `success` or `info` for confirmations and updates. Keep module-specific wording. | Schedule mutations; inventory preparation and traceability |
| Record status | `StatusBadge` with a visible state label. Its tone is supplemental; a badge does not announce changes on its own. | Booking and invoice statuses |
| Loading or empty results | `StateMessage` for short polite updates. Show the loading copy while waiting, the empty copy after a successful empty result, and a separate error if loading fails. | Schedule results; billing report loading |
| Wide tables | `TableRegion` gives a native table a named, keyboard-focusable horizontal scroll area. Keep column headings, row actions, formatting and data rendering in the feature. | Preparation snapshot and traceability |
| Modal form | `StaffDialog` uses the browser's modal dialog behavior. Give it a heading, a visible close action, and a dismissal callback that unmounts it. Use a feature-specific guard in that callback if the workflow must prevent dismissal. | Open Draft Invoice |

Use the shared pieces from `frontend/src/components` as you touch a module. Existing tables and dialogs may have additional behavior, such as nested receipt entry and preserving an operation ID for retry; keep that behavior when adopting a pattern.

Use `Field` inside a client form. Spread its returned props on the input, select or textarea:

```tsx
import { Field } from "@/components/staff-field";
import { Notice } from "@/components/staff-feedback";

<Field label="End time" hint="Use Asia/Colombo time." error={endError}>
  {control => <input {...control} type="datetime-local" value={end} onChange={changeEnd} required />}
</Field>
{saveError && <Notice tone="error">{saveError}</Notice>}
```

Keep validation beside the field when staff can fix that field. Clear a field error after the relevant input changes; use the notice for operation-level failures such as a conflict or unavailable service. For states, render one message per result area:

```tsx
import { Notice, StateMessage, StatusBadge } from "@/components/staff-feedback";
import { TableRegion } from "@/components/staff-table";

{loading ? <StateMessage>Loading invoices…</StateMessage>
  : loadError ? <Notice tone="error">{loadError}</Notice>
  : invoices.length === 0 ? <StateMessage>No invoices match these filters.</StateMessage>
  : <TableRegion label="Invoice results">
      <table>
        <thead><tr><th scope="col">Invoice</th><th scope="col">Status</th></tr></thead>
        <tbody>{invoices.map(invoice => <tr key={invoice.id}>
          <td>{invoice.id}</td>
          <td><StatusBadge>{invoice.statusLabel}</StatusBadge></td>
        </tr>)}</tbody>
      </table>
    </TableRegion>}
```

For an API conflict, show the safe next step and keep the last confirmed result. See the [scheduling conflict notice](../../frontend/src/features/scheduling/scheduling-workspace.tsx), which asks staff to reload and choose another time. For denied or missing records, use generic wording without record details; the [session boundary](../../frontend/src/features/administration/session.tsx) handles route denial and keeps failed sign-out visible with an explicit retry message. The backend still decides access.

For a dialog, keep the trigger in the document while the dialog is open so focus can return to it. Use `type="button"` for actions that dismiss the form:

```tsx
import { StaffDialog } from "@/components/staff-dialog";

<button type="button" onClick={() => setOpen(true)}>Open draft invoice</button>
{open && <StaffDialog labelledBy="draft-title" onDismiss={() => setOpen(false)}>
  <h2 id="draft-title">Open draft invoice</h2>
  <form onSubmit={saveDraft}>
    {/* Form fields */}
    <button type="button" onClick={() => setOpen(false)}>Cancel</button>
    <button type="submit">Save draft</button>
  </form>
</StaffDialog>}
```

When adopting a pattern, check that labels, hints and errors remain readable at 1366×768 and 1024×768; verify Tab, Escape and focus return for a dialog, and ensure wide tables scroll inside the named region. The Playwright scheduling/inventory and billing specs cover the examples above with synthetic API responses. Full AT15 and module acceptance are tracked separately.

Member F verification, 12 November 2026, Windows, on `member-f/task-ui-06-shared-patterns` from `dev` at `c6a44fa`: frontend lint, production build (including TypeScript), 15 unit tests and 27 Edge browser tests passed. The browser checks confirmed a reversed booking window sends no mutation and identifies the end-time field, a failed refresh does not report an empty schedule, the trace table region is reachable by Tab, and Escape returns focus from the draft dialog to its trigger. Member A review remains pending.
