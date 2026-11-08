"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useStaffSession } from "@/features/administration/session";
import { canOpenArea } from "@/lib/api-client";
import { workspaceFor } from "@/lib/workspace-navigation";
import styles from "./heritage-shell.module.css";

export default function HeritageShell({ section, children }: { section: "Overview" | "Reception" | "Patients" | "Consultations" | "Care plans" | "Scheduling" | "Inventory" | "Billing" | "Administration"; children: ReactNode }) {
  const pathname = usePathname();
  const { session, signOut, signingOut } = useStaffSession();
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Colombo" }).format(new Date());
  const roleSection = section === "Patients" ? "Reception" : section === "Consultations" || section === "Care plans" ? "Clinical" : section === "Inventory" ? "Dispensary" : section;
  const workspace = workspaceFor(session?.roles ?? [], roleSection);
  const links = workspace?.links ?? [{ label: "Overview", href: "/workspace" }];
  const activeLink = [...links].filter(link => pathname === link.href || (link.href !== "/workspace" && pathname.startsWith(`${link.href}/`))).sort((a, b) => b.href.length - a.href.length)[0];

  return <div className={styles.shell}>
    <aside className={styles.sidebar} aria-label="Staff workspace navigation">
      <Link className={styles.wordmark} href="/workspace"><Image src="/brand/sprout.svg" alt="" width={24} height={24} />AyurFlow</Link>
      <p className={styles.eyebrow}>Staff workspace</p>
      <Image className={styles.divider} src="/brand/divider.svg" alt="" width={156} height={20} />
      <nav className={styles.nav} aria-label={`${workspace?.title ?? "Staff"} navigation`}>
        {links.filter(link => link.href === "/workspace" || canOpenArea(link.href, session?.roles ?? [])).map(link =>
          <Link key={link.href} href={link.href} aria-current={activeLink?.href === link.href ? "page" : undefined}>{link.label}</Link>
        )}
      </nav>
      <div className={styles.botanical} aria-hidden="true"><Image src="/brand/botanical-admin.svg" alt="" width={115} height={180} /></div>
      <footer className={styles.footer}><span className={styles.eyebrow}>Single clinic</span><span>Thoughtful care.<br />Connected records.</span></footer>
    </aside>
    <div className={styles.body}>
      <header className={styles.topbar}><span>{section === "Overview" ? workspace?.title ?? "Staff workspace" : section}</span><time className={styles.date} suppressHydrationWarning>{date} · Asia/Colombo</time><span className={styles.identity}>{workspace?.title ?? "Staff"}<small>Staff account</small></span><button type="button" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out…" : "Sign out"}</button></header>
      <div className={styles.content}><Image className={styles.leafStart} src="/brand/leaf.svg" alt="" width={16} height={16} />{children}<Image className={styles.leafEnd} src="/brand/leaf.svg" alt="" width={16} height={16} /></div>
    </div>
  </div>;
}
