"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiMutation, APIRequestError } from "@/lib/api-client";
import { useStaffSession } from "@/features/administration/session";

type Staff = { id: string; loginIdentifier: string; active: boolean; roles: string[]; createdAt: string };
type Role = { code: string; name: string };
type Page = { items: Staff[]; roles: Role[]; nextCursor?: string };

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

function RoleChoices({ roles, selected, onChange, disabled, legend }: { roles: Role[]; selected: string[]; onChange: (value: string[]) => void; disabled: boolean; legend: string }) {
  return <fieldset className="my-3 rounded-lg border p-3" disabled={disabled}>
    <legend className="px-1 font-semibold">{legend}</legend>
    <div className="flex flex-wrap gap-x-5 gap-y-2">{roles.map(role => <label key={role.code} className="flex min-h-10 items-center gap-2">
      <input type="checkbox" value={role.code} checked={selected.includes(role.code)} onChange={event => onChange(event.target.checked ? [...selected, role.code] : selected.filter(value => value !== role.code))} />{role.name}
    </label>)}</div>
  </fieldset>;
}

function StaffRow({ staff, roles, actor, busy, change, disable }: { staff: Staff; roles: Role[]; actor?: string; busy: boolean; change: (roles: string[]) => void; disable: () => void }) {
  const [selected, setSelected] = useState(staff.roles);
  return <li className="rounded-xl border border-green-900/15 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold break-all">{staff.loginIdentifier}{actor === staff.id ? " (you)" : ""}</h3><span>{staff.active ? "Active" : "Disabled"}</span></div>
    <form method="post" onSubmit={event => { event.preventDefault(); change(selected); }}>
      <RoleChoices roles={roles} selected={selected} onChange={setSelected} disabled={busy || !staff.active} legend={`Roles for ${staff.loginIdentifier}`} />
      <div className="flex flex-wrap gap-3"><button className="rounded-lg border px-4 py-2 disabled:opacity-50" disabled={busy || !staff.active}>Save roles</button>
        <button type="button" className="rounded-lg border border-red-800 px-4 py-2 text-red-900 disabled:opacity-50" disabled={busy || !staff.active || actor === staff.id} onClick={disable}>Disable account</button></div>
    </form>
  </li>;
}

export default function AdministrationPage() {
  const { session } = useStaffSession();
  const [page, setPage] = useState<Page>({ items: [], roles: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const summary = useRef<HTMLParagraphElement>(null);
  const load = useCallback(async (after = "") => {
    try {
      const value = await apiGet<Page>(`/admin/staff${after ? `?after=${encodeURIComponent(after)}` : ""}`);
      setPage(value);
    }
    catch (error) { setError(messageFor(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    apiGet<Page>("/admin/staff", controller.signal)
      .then(value => { if (!controller.signal.aborted) setPage(value); })
      .catch(error => { if (!controller.signal.aborted) setError(messageFor(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => { if (error) summary.current?.focus(); }, [error]);

  const mutate = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); setLoading(true); await load(); }
    catch (error) { setError(messageFor(error)); }
    finally { setBusy(false); }
  };

  return <section>
    <h1 className="text-3xl font-semibold">Staff administration</h1>
    <p className="my-3">Create assigned staff accounts and manage their access. Role changes and disabling an account end that staff member’s sessions.</p>
    {error && <p ref={summary} tabIndex={-1} role="alert" className="my-4 rounded-lg border border-red-800 p-4">{error}</p>}
    {notice && <p role="status" className="my-4 rounded-lg border p-4">{notice}</p>}
    <form method="post" className="my-6 rounded-xl border bg-white p-5" aria-busy={busy} onSubmit={event => {
      event.preventDefault();
      if (busy) return;
      const form = event.currentTarget;
      const data = new FormData(form);
      const password = String(data.get("password") ?? "");
      if ([...password].length < 15 || new TextEncoder().encode(password).length > 1024) { setError("Use at least 15 password characters. That password may also exceed the system’s size limit."); return; }
      void mutate(async () => {
        await apiMutation<Staff>("/admin/staff", { loginIdentifier: String(data.get("loginIdentifier") ?? ""), password, roles });
        form.reset(); setRoles([]);
      }, "Staff account created. Share the initial password privately with the staff member.");
    }}>
      <h2 className="text-xl font-semibold">Create staff account</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="auth-field-group">Login identifier<input name="loginIdentifier" className="auth-input" maxLength={64} required autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy || loading} /></label>
        <label className="auth-field-group">Initial password<input name="password" type="password" className="auth-input" minLength={15} maxLength={1024} required autoComplete="new-password" disabled={busy || loading} /><span className="auth-field-hint">Use at least 15 characters. Password recovery is not available yet.</span></label>
      </div>
      <RoleChoices roles={page.roles} selected={roles} onChange={setRoles} disabled={busy || loading} legend="Assign roles" />
      <button className="auth-btn-primary" disabled={busy || loading || roles.length === 0}>{busy ? "Saving…" : "Create account"}</button>
    </form>
    <div className="mb-4 flex flex-wrap items-center gap-3"><h2 className="mr-auto text-xl font-semibold">Staff accounts</h2>
      <button className="rounded-lg border px-4 py-2" disabled={busy || loading} onClick={() => { setError(""); setLoading(true); void load(); }}>Refresh first page</button>
      {page.nextCursor && <button className="rounded-lg border px-4 py-2" disabled={busy || loading} onClick={() => { setLoading(true); void load(page.nextCursor); }}>Next page</button>}
    </div>
    {loading && <p role="status">Loading staff…</p>}
    <ul className="space-y-4" aria-busy={loading || busy}>{page.items.map(staff => <StaffRow key={`${staff.id}:${staff.active}:${staff.roles.join(",")}`} staff={staff} roles={page.roles} actor={session?.staffId} busy={busy || loading}
      change={roles => void mutate(() => apiMutation(`/admin/staff/${staff.id}/roles`, { roles }, "PUT"), "Roles saved. The staff member must sign in again.")}
      disable={() => { if (window.confirm(`Disable sign-in for ${staff.loginIdentifier}? Their active sessions will end.`)) void mutate(() => apiMutation(`/admin/staff/${staff.id}/disable`), "Account disabled and sessions ended."); }} />)}</ul>
  </section>;
}
