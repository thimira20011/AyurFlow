"use client";

/* eslint-disable @next/next/no-img-element -- Preserve the intrinsic fractional dimensions of the Figma SVG exports. */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiMutation, APIRequestError } from "@/lib/api-client";
import { useStaffSession } from "@/features/administration/session";
import styles from "@/features/administration/heritage.module.css";

type Staff = { id: string; loginIdentifier: string; active: boolean; roles: string[]; createdAt: string };
type Role = { code: string; name: string };
type StaffPage = { items: Staff[]; roles: Role[]; nextCursor?: string };

function messageFor(error: unknown) {
  if (error instanceof APIRequestError) {
    if (error.code === "csrf_failed") return "Your session token changed. Refresh the page and submit the change again.";
    if (error.status === 403) return "Staff administration is not permitted. Ask an administrator to review your access.";
    if (error.status === 409) return "The request conflicts with the account. Refresh the list. You cannot disable yourself or remove your administrator role.";
    if (error.status === 422) return "Check the login identifier, initial password and selected roles.";
    if (error.status === 401) return "Your session ended. Sign in again.";
  }
  return "The result could not be confirmed. Refresh the list before trying the change again.";
}

function RoleChoices({ roles, selected, onChange, disabled }: { roles: Role[]; selected: string[]; onChange: (value: string[]) => void; disabled: boolean }) {
  const order = ["receptionist", "clinician", "therapist", "dispensary", "billing", "administrator", "report_reader"];
  return <fieldset className={styles.roleChoices} disabled={disabled}>
    <legend>Assign roles explicitly</legend>
    <div className={styles.roleGrid}>{[...roles].sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code)).map(role => <label key={role.code}>
      <input type="checkbox" className={styles.checkbox} value={role.code} checked={selected.includes(role.code)} onChange={event => onChange(event.target.checked ? [...selected, role.code] : selected.filter(value => value !== role.code))} />{role.name}
    </label>)}</div>
  </fieldset>;
}

function StaffDialog({ busy, close, children }: { busy: boolean; close: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element?.showModal();
    return () => { element?.close(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={dialog} className={`${styles.theme} ${styles.dialog}`} aria-labelledby="staff-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }}>{children}</dialog>;
}

export default function AdministrationPage() {
  const { session, signOut, signingOut } = useStaffSession();
  const [page, setPage] = useState<StaffPage>({ items: [], roles: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Staff | "create" | null>(null);
  const [date, setDate] = useState("");
  const summary = useRef<HTMLParagraphElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const load = useCallback(async (after = "") => {
    try { setPage(await apiGet<StaffPage>(`/admin/staff${after ? `?after=${encodeURIComponent(after)}` : ""}`)); }
    catch (error) { setError(messageFor(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    apiGet<StaffPage>("/admin/staff", controller.signal)
      .then(value => { if (!controller.signal.aborted) setPage(value); })
      .catch(error => { if (!controller.signal.aborted) setError(messageFor(error)); })
      .finally(() => { if (!controller.signal.aborted) {
        setLoading(false);
        setDate(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Colombo" }).format(new Date()));
      } });
    return () => controller.abort();
  }, []);
  useEffect(() => { if (error) summary.current?.focus(); }, [error]);

  const closeDialog = () => { setEditing(null); setError(""); };
  const mutate = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(); setEditing(null); setNotice(success); setLoading(true); await load(); }
    catch (error) { setError(messageFor(error)); }
    finally { setBusy(false); }
  };
  const errorMessage = error && <p ref={summary} tabIndex={-1} role="alert" className={styles.error}>{error}</p>;
  const target = editing && editing !== "create" ? editing : null;

  return <div className={`${styles.theme} ${styles.staffPage}`}>
    <aside className={styles.sidebar} aria-label="Administration navigation">
      <Link className={styles.wordmark} href="/workspace"><span className={styles.sprout}><img src="/brand/sprout.svg" alt="" /></span>AyurFlow</Link>
      <p className={styles.eyebrow}>STAFF WORKSPACE</p>
      <div className={styles.sidebarDivider} aria-hidden="true"><img src="/brand/divider.svg" alt="" /></div>
      <nav className={styles.sideNav}>
        <Link href="/administration" aria-current="page">Staff &amp; roles</Link>
        <button disabled title="Reference-data management is not implemented">Reference data</button>
        <button disabled title="Audit retrieval requires a reviewed access policy">Audit history</button>
      </nav>
      <div className={styles.sideBotanical} aria-hidden="true"><img src="/brand/botanical-admin.svg" alt="" /></div>
      <footer className={styles.sidebarFooter}><p className={styles.eyebrow}>SINGLE CLINIC</p><p>Thoughtful care.<br />Connected records.</p><Link href="/administration/clinical-assignments">Clinician assignments →</Link><Link href="/workspace">Return to workspace</Link></footer>
    </aside>
    <div className={styles.staffWorkspace}>
      <header className={styles.staffHeader}>
        <span>Staff &amp; roles</span><span className={styles.date}>{date && `${date} · Asia/Colombo`}</span>
        <span className={styles.identity}>Administrator<small>Staff account</small></span>
        <button className={styles.signOut} type="button" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out…" : "Sign out"}</button>
      </header>
      <section className={styles.content} aria-label="Staff administration">
        <span className={styles.leafStart} aria-hidden="true"><img src="/brand/leaf.svg" alt="" /></span>
        <header className={styles.contentHeading}>
          <div><p className={styles.eyebrow}>ADMINISTRATION</p><h1>The people behind the care.</h1><p>Create controlled staff access with explicitly assigned roles.</p></div>
          <button ref={createButton} type="button" className={styles.primary} disabled={busy || loading} onClick={() => { setError(""); setSelectedRoles([]); setEditing("create"); }}>+ Create staff account</button>
        </header>
        <p className={styles.notice}>Administrator access does not include clinical notes.</p>
        {!editing && errorMessage}
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        {loading && <p role="status">Loading staff…</p>}
        <div className={styles.tableWrap}><table className={styles.staffTable} aria-label="Staff accounts" aria-busy={loading || busy}>
          <thead><tr><th scope="col">Staff member</th><th scope="col">Login</th><th scope="col">Assigned roles</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
          <tbody>{page.items.map(staff => <tr key={staff.id}>
            <td>{session?.staffId === staff.id ? "Your account" : "Staff account"}</td><td>{staff.loginIdentifier}</td>
            <td>{staff.roles.map(code => page.roles.find(role => role.code === code)?.name ?? code).join(", ")}</td>
            <td><span className={`${styles.status} ${!staff.active ? styles.disabledStatus : ""}`}>{staff.active ? "Active" : "Disabled"}</span></td>
            <td><button type="button" className={styles.textButton} disabled={busy || loading} aria-label={`${staff.active ? "Manage access" : "View account"} for ${staff.loginIdentifier}`} onClick={() => { setError(""); setSelectedRoles(staff.roles); setEditing(staff); }}>{staff.active ? "Manage access →" : "View account →"}</button></td>
          </tr>)}{!loading && !page.items.length && <tr><td colSpan={5}>No staff accounts on this page.</td></tr>}</tbody>
        </table></div>
        <div className={styles.accountControls}><p className={styles.accountInfo}>Disabling an account ends its active sessions. Roles are never inferred from a staff title.</p>
        <nav className={styles.pagination} aria-label="Staff list pages"><button type="button" className={styles.textButton} disabled={busy || loading} onClick={() => { setError(""); setLoading(true); void load(); }}>Refresh first page</button>{page.nextCursor && <button type="button" className={styles.textButton} disabled={busy || loading} onClick={() => { setLoading(true); void load(page.nextCursor); }}>Next page →</button>}</nav>
        </div>
        <span className={styles.leafEnd} aria-hidden="true"><img src="/brand/leaf.svg" alt="" /></span>
      </section>
    </div>
    {editing && <StaffDialog busy={busy} close={closeDialog}>
      <form method="post" aria-busy={busy} onSubmit={event => {
        event.preventDefault();
        if (busy) return;
        if (editing === "create") {
          const form = event.currentTarget, data = new FormData(form);
          const password = String(data.get("password") ?? "");
          if ([...password].length < 15 || new TextEncoder().encode(password).length > 1024) { setError("Use at least 15 password characters and at most 1024 UTF-8 bytes."); return; }
          void mutate(async () => { await apiMutation<Staff>("/admin/staff", { loginIdentifier: String(data.get("loginIdentifier") ?? ""), password, roles: selectedRoles }); form.reset(); }, "Staff account created. Share the initial password privately with the staff member.");
        } else {
          void mutate(() => apiMutation(`/admin/staff/${editing.id}/roles`, { roles: selectedRoles }, "PUT"), "Roles saved. The staff member must sign in again.");
        }
      }}>
        <p className={styles.eyebrow}>CONTROLLED STAFF ACCESS</p>
        <h2 id="staff-dialog-title">{editing === "create" ? "Create a staff account" : `Access for ${editing.loginIdentifier}`}</h2>
        <p>{editing === "create" ? "Assign only the roles this person needs. Clinical access also requires the appropriate record permissions." : "Role changes and disabling end this staff member’s active sessions."}</p>
        {errorMessage}
        {editing === "create" && <>
          <div className={styles.field}><label htmlFor="create-login">Login identifier *</label><input id="create-login" name="loginIdentifier" className={styles.input} placeholder="Enter a staff login identifier" maxLength={64} required autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy} /></div>
          <div className={styles.field}><label htmlFor="create-password">Initial password *</label><input id="create-password" name="password" type="password" className={styles.input} placeholder="At least 15 characters" minLength={15} maxLength={1024} required autoComplete="new-password" disabled={busy} /></div>
        </>}
        <RoleChoices roles={page.roles} selected={selectedRoles} onChange={setSelectedRoles} disabled={busy || Boolean(target && !target.active)} />
        <p className={styles.dialogHint}>Additional report access is granted by report category. Password recovery is not available yet.</p>
        <div className={styles.dialogActions}>
          <button className={styles.primary} disabled={busy || !selectedRoles.length || Boolean(target && !target.active)}>{busy ? "Saving…" : editing === "create" ? "Create staff account" : "Save roles"}</button>
          <button type="button" className={styles.secondary} disabled={busy} onClick={() => { closeDialog(); createButton.current?.focus(); }}>Cancel</button>
        </div>
        {target && <button type="button" className={styles.secondary} disabled={busy || !target.active || target.id === session?.staffId} onClick={() => { if (window.confirm(`Disable sign-in for ${target.loginIdentifier}? Their active sessions will end.`)) void mutate(() => apiMutation(`/admin/staff/${target.id}/disable`), "Account disabled and sessions ended."); }}>Disable account</button>}
      </form>
    </StaffDialog>}
  </div>;
}
