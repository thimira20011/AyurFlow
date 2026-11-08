"use client";

import Link from "next/link";
import HeritageShell from "@/features/clinical/heritage-shell";
import { useStaffSession } from "@/features/administration/session";
import { workspaces } from "@/lib/workspace-navigation";
import styles from "@/components/staff-surfaces.module.css";

const descriptions: Record<string, string> = {
  receptionist: "Find a patient, register a new record, and review the day ahead.",
  clinician: "Continue a consultation and review the ordered care pathway.",
  therapist: "Review assigned sessions and record treatment delivery.",
  dispensary: "Review botanical batches, recipes, preparations, and traceability.",
  billing: "Review invoices, receipts, and outstanding balances.",
  administrator: "Manage controlled staff access and clinician assignments.",
};

export default function WorkspacePage() {
  const { session } = useStaffSession();
  const areas = workspaces.filter(area => session?.roles.includes(area.role));
  return <HeritageShell section="Overview"><div className={styles.page}>
    <header className={styles.heading}>
      <p className={styles.eyebrow}>STAFF WORKSPACE</p>
      <h1>Staff workspace</h1>
      <p>Choose the work available to your staff account. The server checks access to each record.</p>
    </header>
    {areas.length ? <div className={styles.areaGrid}>{areas.map(area => <section className={styles.card} key={area.role} aria-labelledby={`${area.role}-title`}>
      <p className={styles.eyebrow}>{area.title.toUpperCase()}</p>
      <h2 id={`${area.role}-title`}>{area.title} workspace</h2>
      <p>{descriptions[area.role]}</p>
      <div className={styles.actions}>{area.links.filter(link => link.href !== "/workspace").map((link, index) => <Link key={link.href} className={index === 0 ? styles.primary : styles.secondary} href={link.href}>{area.role === "receptionist" && link.href === "/reception" ? "Reception desk" : link.label}</Link>)}</div>
    </section>)}</div> : <section className={styles.card} role="status"><h2>No work areas assigned</h2><p>Ask an administrator to review your roles.</p></section>}
  </div></HeritageShell>;
}
