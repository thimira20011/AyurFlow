"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { APIRequestError } from "@/lib/api-client";
import { useStaffSession } from "./session";

export function SignInForm() {
  const { signIn, session, loading, error: sessionError } = useStaffSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const summary = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (session) router.replace("/workspace"); }, [session, router]);
  useEffect(() => { if (error) summary.current?.focus(); }, [error]);

  return <form method="post" className="auth-form" aria-busy={busy} onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError("");
    try {
      await signIn(String(data.get("loginIdentifier") ?? ""), String(data.get("password") ?? ""));
      form.reset(); router.replace("/workspace");
    } catch (error) {
      setError(error instanceof APIRequestError && error.code === "invalid_credentials"
        ? "The login identifier or password is incorrect. Try again or contact your administrator."
        : "Sign in is unavailable. Check the connection and ask your administrator to confirm HTTPS and authentication setup.");
    } finally { setBusy(false); }
  }}>
    {error && <p ref={summary} tabIndex={-1} role="alert" className="auth-notice">{error}</p>}
    {!error && sessionError && <p role="status" className="auth-notice">{sessionError}</p>}
    <div className="auth-field-group"><label htmlFor="signin-login" className="auth-label">Login identifier</label>
      <input id="signin-login" name="loginIdentifier" className="auth-input" autoComplete="username" required maxLength={64} autoCapitalize="none" spellCheck={false} />
    </div>
    <div className="auth-field-group"><label htmlFor="signin-password" className="auth-label">Password</label>
      <input id="signin-password" name="password" type="password" className="auth-input" autoComplete="current-password" required maxLength={1024} />
    </div>
    <button type="submit" className="auth-btn-primary" disabled={busy || loading}>{busy ? "Signing in…" : loading ? "Checking session…" : "Sign in"}</button>
    <p className="auth-field-hint">Use the account assigned by your administrator. For access or password help, contact them directly.</p>
  </form>;
}
