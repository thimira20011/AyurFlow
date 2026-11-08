# Dashboard overview

Frontend presentation work for shared UI (TASK-SET-06, owner F/reviewer A; AT15 viewport and keyboard review). Replaces the old `/dashboard` with the user-supplied Overview reference: sidebar, live Colombo date, greeting, care banner, summary metrics and upcoming sessions. Uses existing exported artwork in `public/brand` and scoped CSS. The global navbar and constrained main container are bypassed only for this route.

Counts and sessions in `dashboard-data.ts` are synthetic and labelled in the UI. No scheduling or clinical mutation is simulated. View Session opens a native modal with Escape/focus management; Register Patient opens the existing `/patients?action=register` flow; schedule navigation opens `/scheduling` (currently a placeholder). The shared session bar is replaced on this route by sidebar Workspace and Sign out controls using the existing session hook; authentication behavior is unchanged. This UI does not establish backend authorization or AT acceptance.

The session contract has no display-name field. Maya is shown only for the existing named demo identity; other sessions use Staff. Dates and greetings use Asia/Colombo. Integrate reviewed aggregate/session endpoints and staff display names when those contracts become available.
