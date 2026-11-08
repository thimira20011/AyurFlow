"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStaffSession } from "@/features/administration/session";
import { canOpenArea } from "@/lib/api-client";
import { overviewMetrics, upcomingSessions, type DashboardSession } from "./dashboard-data";
import styles from "./dashboard.module.css";

const navigation = [
  { href: "/dashboard", label: "Overview" },
  { href: "/patients", label: "Patients" },
  { href: "/scheduling", label: "Schedule" },
];

export function DashboardOverview() {
  const { session, signOut, signingOut } = useStaffSession();
  const [now, setNow] = useState<Date | null>(null);
  const [selectedSession, setSelectedSession] = useState<DashboardSession | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const roles = session?.roles ?? [];
  const displayName = session?.staffId === "maya-reception-01" ? "Maya" : "Staff";
  const accountRole = roles.includes("receptionist") ? "Reception" : "Staff";

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedSession && !dialog.current?.open) dialog.current?.showModal();
  }, [selectedSession]);

  const date = now ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Colombo" }).format(now) : "—";
  const dayHeading = now ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Colombo" }).format(now) : "Today";
  const hour = now ? Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Colombo" }).format(now)) : 9;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  function viewSession(item: DashboardSession) {
    setSelectedSession(item);
  }

  return <div className={styles.workspace}>
    <aside className={styles.sidebar} aria-label="Staff workspace">
      <Link href="/dashboard" className={styles.brand}><Image src="/brand/sprout.svg" alt="" width={23} height={24} /><span>AyurFlow</span></Link>
      <p className={styles.workspaceLabel}>Staff workspace</p>
      <Image src="/brand/divider.svg" alt="" width={158} height={14} className={styles.divider} />
      <nav aria-label="Dashboard navigation" className={styles.navigation}>{navigation.filter(item => canOpenArea(item.href, roles)).map(item => <Link key={item.href} href={item.href} aria-current={item.href === "/dashboard" ? "page" : undefined}>{item.label}</Link>)}</nav>
      <div className={styles.botanical}><Image src="/brand/botanical-admin.svg" alt="" width={91} height={148} /></div>
      <footer className={styles.sidebarFooter}><p>Single clinic</p><span>Thoughtful care.<br />Connected records.</span></footer>
      <div className={styles.sessionActions}><Link href="/workspace">Workspace</Link><button type="button" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out…" : "Sign out"}</button></div>
    </aside>
    <div className={styles.mainColumn}>
      <header className={styles.topbar}><span className={styles.sectionLabel}>Overview</span><div className={styles.topbarRight}><span className={styles.date}>{date} · Asia/Colombo</span><div className={styles.account}><strong>{displayName} · {accountRole}</strong><span>Staff account</span></div></div></header>
      <div className={styles.canvas}>
        <Image src="/brand/leaf.svg" alt="" width={17} height={17} className={styles.topLeaf} />
        <Image src="/brand/leaf.svg" alt="" width={17} height={17} className={styles.bottomLeaf} />
        <div className={styles.content}>
          <div className={styles.greeting}><div><p className={styles.dayHeading}>{dayHeading}</p><h1>{greeting}, {displayName}.</h1><p>A clear view of the day ahead.</p></div>{canOpenArea("/patients", roles) && <Link href="/patients?action=register" className={styles.register}>+ Register patient</Link>}</div>
          <section className={styles.welcome} aria-label="A thoughtful start"><div><h2>A thoughtful start to every visit</h2><p>Find a patient, review the schedule, and keep the clinic moving with care.</p></div><Image src="/brand/mortar.svg" alt="" width={127} height={121} className={styles.mortar} /></section>
          <dl className={styles.metrics}>{overviewMetrics.map(metric => <div key={metric.label}><dd>{metric.value}</dd><dt>{metric.label}</dt></div>)}</dl>
          <section className={styles.sessions} aria-labelledby="upcoming-heading"><div className={styles.sessionsHeading}><h2 id="upcoming-heading">Upcoming sessions</h2>{canOpenArea("/scheduling", roles) && <Link href="/scheduling">View schedule</Link>}</div>
            <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Upcoming sessions table"><table><thead><tr>{["Time", "Patient", "Therapist", "Room", "Status", "Action"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{upcomingSessions.map(item => <tr key={item.id}><td>{item.time}</td><td>{item.patient}</td><td>{item.therapist}</td><td>{item.room}</td><td><span className={styles.status}>{item.status}</span></td><td><button type="button" onClick={() => viewSession(item)} aria-label={`View session for ${item.patient}`}>View session <span aria-hidden="true">→</span></button></td></tr>)}</tbody></table></div>
          </section>
          <p className={styles.previewNote}>Synthetic overview · Summary counts and sessions are sample data.</p>
        </div>
      </div>
    </div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="session-heading" onClose={() => setSelectedSession(null)}>
      {selectedSession && <><p className={styles.dayHeading}>Session overview · Synthetic</p><h2 id="session-heading">{selectedSession.patient}</h2><dl>{[["Time", `${selectedSession.time} · Asia/Colombo`], ["Therapist", selectedSession.therapist], ["Room", selectedSession.room], ["Status", selectedSession.status]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={styles.dialogNote}>This is a sample booking for design review.</p><form method="dialog"><button className={styles.register}>Close session</button></form></>}
    </dialog>
  </div>;
}
