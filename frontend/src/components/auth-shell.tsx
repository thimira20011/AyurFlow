/* eslint-disable @next/next/no-img-element -- Preserve the intrinsic fractional dimensions of the Figma SVG exports. */
import Link from "next/link";
import styles from "@/features/administration/heritage.module.css";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return <div className={`${styles.theme} ${styles.authShell}`}>
    <aside className={styles.welcome} aria-label="AyurFlow Heritage">
      <Link href="/workspace" className={styles.wordmark} aria-label="AyurFlow home">
        <span className={styles.sprout}><img src="/brand/sprout.svg" alt="" /></span>AyurFlow
      </Link>
      <div className={styles.welcomeSpacer} />
      <p className={styles.eyebrow}>WELCOME TO AYURFLOW</p>
      <h1 className={styles.welcomeTitle}>Care, carried<br />forward.</h1>
      <p className={styles.welcomeIntro}>A calm space for the people<br />behind every patient journey.</p>
      <div className={styles.signature}>
        <div className={styles.botanicalSlot} aria-hidden="true"><img src="/brand/botanical-signin.svg" alt="" /></div>
        <div className={styles.philosophy}>
          <p className={styles.eyebrow}>ROOTED IN TRADITION</p>
          <p>Connected records.<br />Considered decisions.<br />Continuity of care.</p>
        </div>
        <div className={styles.mortarSlot} aria-hidden="true"><img src="/brand/mortar.svg" alt="" /></div>
      </div>
      <p className={styles.welcomeFooter}>Single clinic · Staff access only</p>
    </aside>
    <section className={styles.formPanel} aria-label="Staff access">{children}</section>
  </div>;
}
