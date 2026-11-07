import Link from "next/link";
import { modules, type ModuleSlug } from "@/lib/modules";
import styles from "./staff-surfaces.module.css";

export function ModulePlaceholder({ slug }: { slug: ModuleSlug }) {
  const workArea = modules.find(item => item.slug === slug)!;
  return <div className={styles.page}>
    <header className={styles.heading}>
      <p className={styles.eyebrow}>{workArea.id} · STAFF WORKSPACE</p>
      <h1>{workArea.title}</h1>
      <p>{workArea.description}</p>
    </header>
    <section className={styles.card} role="status">
      <span className={styles.status}>Screen in progress</span>
      <h2>This work area is being built.</h2>
      <p>Records and actions for this area are not yet available here.</p>
      <div className={styles.actions}><Link className={styles.secondary} href="/workspace">Return to workspace</Link></div>
    </section>
  </div>;
}
