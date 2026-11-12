import type { ReactNode } from "react";
import styles from "./staff-patterns.module.css";

export function TableRegion({ label, children }: { label: string; children: ReactNode }) {
  return <div className={styles.tableRegion} role="region" aria-label={label} tabIndex={0}>{children}</div>;
}
