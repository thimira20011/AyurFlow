# Billing interface

Feature-specific forms, tables, hooks and API types belong here. `/billing` currently shows a labelled synthetic, browser-memory invoice and receipt preview within the shared staff shell. Its `api.ts` defines real API calls, but `billing-workspace.tsx` does not use them yet. The preview is not a persisted billing workflow. Follow the matching backend module README and shared OpenAPI contract before connecting it; do not use browser visibility as authorization.
