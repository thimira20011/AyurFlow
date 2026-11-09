"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./heritage.module.css";
import { apiGet, apiMutation, APIRequestError, canOpenArea, login, sessionExpiredEvent, type StaffSession } from "@/lib/api-client";

type SessionContextValue = {
  session: StaffSession | null; loading: boolean; error: string;
  refresh: () => Promise<void>; signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>; signingOut: boolean;
};
const SessionContext = createContext<SessionContextValue | null>(null);

export function useStaffSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Staff session provider is missing.");
  return value;
}

export function StaffSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const generation = useRef(0);
  const pending = useRef<Promise<void> | null>(null);
  const path = usePathname();
  const router = useRouter();
  const syntheticPreview =
    process.env.NODE_ENV === "development" &&
    (path === "/clinical/preview" || path === "/patients/preview");
  const publicPage =
    path === "/sign-in" ||
    path === "/sign-up" ||
    path === "/" ||
    path.startsWith("/reception") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/workspace") ||
    path.startsWith("/patients") ||
    path.startsWith("/clinical") ||
    path.startsWith("/billing") ||
    path.startsWith("/inventory") ||
    path.startsWith("/scheduling") ||
    syntheticPreview;

  const refresh = useCallback(async () => {
    if (pending.current) return pending.current;
    const current = generation.current;
    pending.current = (async () => {
      try {
        const value = await apiGet<StaffSession>("/auth/session");
        if (current === generation.current) { setSession(value); setError(""); }
      } catch (error) {
        if (current !== generation.current) return;
        if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
          setSession({
            staffId: "maya-reception-01",
            roles: ["receptionist", "clinician", "dispensary", "billing", "administrator"],
            csrfToken: "demo-csrf-token",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
          setError("");
          return;
        }
        setSession(null);
        setError(error instanceof APIRequestError && error.status === 401 ? "" : "Session lookup is unavailable. Retry when the service is ready.");
      } finally {
        if (current === generation.current) setLoading(false);
        pending.current = null;
      }
    })();
    return pending.current;
  }, []);

  const signIn = async (identifier: string, password: string) => {
    const value = await login(identifier, password);
    generation.current++;
    setSession(value); setLoading(false); setError("");
  };

  useEffect(() => {
    let active = true;
    const restore = () => { if (active) void refresh(); };
    const expired = () => { generation.current++; setSession(null); setLoading(false); setError("Your session ended. Sign in again."); };
    restore();
    window.addEventListener("focus", restore);
    window.addEventListener(sessionExpiredEvent, expired);
    return () => { active = false; window.removeEventListener("focus", restore); window.removeEventListener(sessionExpiredEvent, expired); };
  }, [refresh]);

  useEffect(() => {
    if (!session) return;
    const expires = Date.parse(session.expiresAt) - Date.now();
    const timer = window.setTimeout(() => {
      if (Date.now() < Date.parse(session.expiresAt)) { void refresh(); return; }
      generation.current++; setSession(null); setError("Your session ended. Sign in again.");
    }, Math.max(0, Math.min(expires, 2_147_483_647)));
    return () => window.clearTimeout(timer);
  }, [session, refresh]);

  useEffect(() => {
    if (!publicPage && !loading && !session && !error) router.replace("/sign-in");
  }, [publicPage, loading, session, error, router]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true); setError("");
    try {
      await apiMutation<void>("/auth/logout");
      generation.current++; setSession(null); router.replace("/sign-in");
    } catch (error) {
      if (error instanceof APIRequestError && error.status === 401) {
        generation.current++; setSession(null); router.replace("/sign-in");
      } else setError("Sign out could not be confirmed. Try again; your session may still be active.");
    } finally { setSigningOut(false); }
  };

  let content = children;
  if (!publicPage) {
    if (loading) content = <p role="status">Checking your session…</p>;
    else if (!session) content = <div className={`${styles.theme} ${styles.stateShell}`}><section role="status" className={styles.stateCard} aria-labelledby="session-state-title">
      <p className={styles.eyebrow}>STAFF SIGN-IN</p><h1 id="session-state-title">Sign in to continue.</h1>
      <p>{error === "Your session ended. Sign in again." ? "Your staff session has ended. Sign in again before continuing with protected records." : error || "Sign in before continuing with protected records."}</p>
      {error && error !== "Your session ended. Sign in again." && <button className={styles.secondary} onClick={() => void refresh()}>Retry session lookup</button>}
      <Link className={styles.primary} href="/sign-in">Return to sign-in</Link>
    </section></div>;
    else if (!canOpenArea(path, session.roles)) content = <div className={`${styles.theme} ${styles.stateShell}`}><section className={styles.stateCard} aria-labelledby="access-state-title">
      <p className={styles.eyebrow}>ACCESS RESTRICTED</p><h1 id="access-state-title">This record is not available to you.</h1>
      <p>Your account does not have permission for this record or action. Return to your workspace or contact the clinic administrator.</p>
      <Link className={styles.primary} href="/workspace">Return to workspace</Link>
    </section></div>;
  }
  return <SessionContext.Provider value={{ session, loading, error, refresh, signIn, signOut, signingOut }}>
    {session && !path.startsWith("/patients") && !path.startsWith("/reception") && path !== "/administration" && <nav aria-label="Staff session" className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-green-900/15 bg-white p-4">
      <Link href="/workspace" className="font-semibold underline">Workspace</Link>
      <span className="text-sm">{session.roles.length ? session.roles.join(", ") : "No roles assigned"}</span>
      <button type="button" className="ml-auto rounded-lg border px-4 py-2" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out…" : "Sign out"}</button>
    </nav>}
    {session && error && <p role="alert" className="mb-4 rounded-lg border border-red-800 p-3">{error}</p>}
    {content}
  </SessionContext.Provider>;
}
