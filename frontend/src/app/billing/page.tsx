"use client";

import { BillingWorkspace } from "@/features/billing/billing-workspace";
import HeritageShell from "@/features/clinical/heritage-shell";
import styles from "@/components/staff-surfaces.module.css";

export default function BillingPage() {
  return <HeritageShell section="Billing"><section className={styles.page}>
    <p className={styles.notice} role="status">Synthetic billing preview. Changes on this screen are not saved to clinic records.</p>
    <BillingWorkspace />
  </section></HeritageShell>;
}
