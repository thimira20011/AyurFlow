"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { APIRequestError } from "@/lib/api-client";
import { useStaffSession } from "./session";
import styles from "./heritage.module.css";

export function SignInForm() {
  const { signIn, session, loading, error: sessionError } = useStaffSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const summary = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (session) router.replace("/workspace"); }, [session, router]);
  useEffect(() => { if (error) summary.current?.focus(); }, [error]);

  return <form id="sign-in-form" method="post" className={styles.signInForm} aria-busy={busy} onSubmit={async event => {
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
    {error && <p ref={summary} tabIndex={-1} role="alert" className={styles.error}>{error}</p>}
    {!error && sessionError && <p role="status" className={styles.error}>{sessionError}</p>}
    <div className={styles.field}><label htmlFor="signin-login">Login identifier</label>
      <input id="signin-login" name="loginIdentifier" className={styles.input} placeholder="Enter your login identifier" autoComplete="username" required maxLength={64} autoCapitalize="none" spellCheck={false} />
    </div>
    <div className={styles.field}><label htmlFor="signin-password">Password</label>
      <input id="signin-password" name="password" type={showPassword ? "text" : "password"} className={styles.input} placeholder="Enter your password" autoComplete="current-password" required maxLength={1024} />
    </div>
    <label className={styles.passwordVisibility}><input type="checkbox" className={styles.checkbox} checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />Show password</label>
    <button id="signin-submit" type="submit" className={`${styles.primary} ${styles.signInSubmit}`} disabled={busy || loading}>{busy ? "Signing in…" : loading ? "Checking session…" : "Sign in"}</button>
  </form>;
}
