"use client";

import Link from "next/link";
import styles from "./reception-desk.module.css";

export function ReceptionDeskView() {
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Colombo",
  }).format(new Date());

  return <div className={styles.page}>
    <header className={styles.heading}>
      <div>
        <p className={styles.eyebrow} suppressHydrationWarning>{today.toUpperCase()} · RECEPTION</p>
        <h1>Every visit begins here.</h1>
        <p>Find an existing patient before creating a new record.</p>
      </div>
      <Link className={styles.primary} href="/patients?action=register">+ Register patient</Link>
    </header>

    <section className={styles.banner} aria-labelledby="patient-start-title">
      <div>
        <h2 id="patient-start-title">A thoughtful start to every visit</h2>
        <p>Search the clinic registry, then open the patient record or complete registration.</p>
      </div>
      <Link className={styles.secondary} href="/patients">Find a patient</Link>
    </section>

    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="registry-title">
        <p className={styles.eyebrow}>PATIENT RECORDS</p>
        <h2 id="registry-title">Registration and search</h2>
        <p>The patient registry uses your staff session. Registration, identity checks, and demographic updates are saved through the protected patient service.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/patients">Open patient registry</Link>
          <Link className={styles.secondary} href="/patients?action=register">Register a patient</Link>
        </div>
      </section>
      <section className={styles.card} aria-labelledby="schedule-title">
        <p className={styles.eyebrow}>TODAY&apos;S SCHEDULE</p>
        <h2 id="schedule-title">Sessions are not available here yet</h2>
        <p role="status">The reception overview is not connected to the scheduling service. Session counts, arrivals, and room use cannot be shown until that connection is ready.</p>
        <div className={styles.actions}><Link className={styles.secondary} href="/scheduling">Open scheduling area</Link></div>
      </section>
    </div>
  </div>;
}
