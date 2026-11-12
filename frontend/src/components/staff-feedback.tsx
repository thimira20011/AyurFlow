import type { ReactNode } from "react";
import styles from "./staff-patterns.module.css";

export function Notice({ tone = "info", children }: {
  tone?: "info" | "success" | "error";
  children: ReactNode;
}) {
  return <p className={styles.notice} data-tone={tone} role={tone === "error" ? "alert" : "status"}>{children}</p>;
}

export function StatusBadge({ tone = "neutral", children }: {
  tone?: "neutral" | "positive" | "negative";
  children: ReactNode;
}) {
  return <span className={styles.badge} data-tone={tone}>{children}</span>;
}

export function StateMessage({ children }: { children: ReactNode }) {
  return <p className={styles.state} role="status">{children}</p>;
}
