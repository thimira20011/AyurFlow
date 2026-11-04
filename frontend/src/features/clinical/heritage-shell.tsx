"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useStaffSession } from "@/features/administration/session";
import { canOpenArea } from "@/lib/api-client";
import styles from "./heritage-shell.module.css";

export default function HeritageShell({ section, children }: { section: "Patients" | "Consultations" | "Care plans"; children: ReactNode }) {
  const pathname = usePathname();
  const { session, signOut, signingOut } = useStaffSession();
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Colombo" }).format(new Date());
  const clinician = section !== "Patients";
  const links = clinician
    ? [{ label: "Overview", href: "/workspace" }, { label: "Consultations", href: "/clinical" }, { label: "Care plans", href: "/clinical/plans" }, { label: "Sessions", href: "/scheduling" }]
    : [{ label: "Overview", href: "/workspace" }, { label: "Patients", href: "/patients" }, { label: "Schedule", href: "/scheduling" }];

  return <div className={styles.shell}>
    <aside className={styles.sidebar} aria-label="Staff workspace navigation">
      <Link className={styles.wordmark} href="/workspace"><Image src="/brand/sprout.svg" alt="" width={24} height={24} />AyurFlow</Link>
      <p className={styles.eyebrow}>Staff workspace</p>
      <Image className={styles.divider} src="/brand/divider.svg" alt="" width={156} height={20} />
      <nav className={styles.nav} aria-label={clinician ? "Clinical navigation" : "Reception navigation"}>
        {links.filter(link => link.href === "/workspace" || canOpenArea(link.href, session?.roles ?? [])).map(link =>
          <Link key={link.href} href={link.href} aria-current={pathname === link.href || (link.href === "/patients" && pathname.startsWith("/patients")) ? "page" : undefined}>{link.label}</Link>
        )}
      </nav>
      <div className={styles.botanical} aria-hidden="true"><Image src="/brand/botanical-admin.svg" alt="" width={115} height={180} /></div>
      <footer className={styles.footer}><span className={styles.eyebrow}>Single clinic</span><span>Thoughtful care.<br />Connected records.</span></footer>
    </aside>
    <div className={styles.body}>
      <header className={styles.topbar}><span>{section}</span><time className={styles.date} suppressHydrationWarning>{date} · Asia/Colombo</time><span className={styles.identity}>{session?.roles.join(", ") || "Staff"}<small>Staff account</small></span><button type="button" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out…" : "Sign out"}</button></header>
      <div className={styles.content}><Image className={styles.leafStart} src="/brand/leaf.svg" alt="" width={16} height={16} />{children}<Image className={styles.leafEnd} src="/brand/leaf.svg" alt="" width={16} height={16} /></div>
    </div>
  </div>;
}
