"use client";

import { useEffect, useState } from "react";
import { Notice, StateMessage } from "@/components/staff-feedback";
import { TableRegion } from "@/components/staff-table";
import { APIRequestError } from "@/lib/api-client";
import { listStockBatches, type BatchSummaryTotals, type EligibilityStatus, type StockBatchPage } from "./api";
import InventoryTrace from "./inventory-trace";
import styles from "./inventory-workspace.module.css";

const categories: [keyof BatchSummaryTotals, string][] = [
  ["eligibleGrams", "Eligible"], ["blockedGrams", "Blocked"],
  ["expiredGrams", "Expired"], ["unknownExpiryGrams", "Unknown expiry"],
];
const eligibility: Record<EligibilityStatus, string> = {
  eligible: "Eligible", blocked: "Blocked", expired: "Expired",
  unknown_expiry: "Unknown expiry", depleted: "Depleted",
};

export default function InventoryReport() {
  const [query, setQuery] = useState({ eligibleOnly: false, cursor: "" });
  const [page, setPage] = useState<StockBatchPage | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    listStockBatches(query.eligibleOnly, "", controller.signal, query.cursor).then(result => {
      if (!controller.signal.aborted) setPage(result);
    }, failure => {
      if (controller.signal.aborted) return;
      setError(failure instanceof APIRequestError && failure.status === 403
        ? "The stock report is unavailable to your account."
        : "The stock report could not be loaded. Try again.");
    });
    return () => controller.abort();
  }, [query]);

  function load(eligibleOnly: boolean, cursor = "") {
    setPage(null);
    setError("");
    setQuery({ eligibleOnly, cursor });
  }

  return <div className={styles.workspace}>
    <header className={styles.headerArea}><h1 className={styles.title}>Stock and traceability report</h1></header>
    <div className={styles.equalGrid}>
      <section className={`${styles.panel} ${styles.fullWidth}`} aria-labelledby="stock-report-title">
        <h2 id="stock-report-title" className={styles.panelTitle}>Stock balances</h2>
        <div className={styles.actions}>
          <label><input type="checkbox" checked={query.eligibleOnly}
            onChange={event => load(event.target.checked)} /> Eligible batches only</label>
          <button type="button" className={styles.secondaryBtn} onClick={() => load(query.eligibleOnly)}>Refresh stock</button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {!page && !error && <StateMessage>Loading stock balances…</StateMessage>}
        {page && <>
          <p className={styles.hint}>Totals across all batch statuses as of {page.clinicDate} in Colombo.</p>
          <dl className={styles.statsGrid}>{categories.map(([key, label]) => <div className={styles.statCard} key={key}>
            <dt className={styles.statLabel}>{label}</dt><dd className={styles.statValue}>{page.summary[key]} g</dd>
          </div>)}</dl>
          {page.items?.length ? <TableRegion label="Stock batches"><table className={styles.table}>
            <thead><tr><th scope="col">Batch</th><th scope="col">Botanical</th><th scope="col">Remaining</th>
              <th scope="col">Expiry date</th><th scope="col">Status</th></tr></thead>
            <tbody>{page.items.map(batch => <tr key={batch.id}>
              <td>{batch.batchReference}<div className={styles.hint}>{batch.id}</div></td>
              <td>{batch.itemDisplayName}</td><td>{batch.remainingGrams} g</td>
              <td>{batch.expiresAt ?? "Unknown"}</td><td>{eligibility[batch.eligibility]}</td>
            </tr>)}</tbody>
          </table></TableRegion> : <StateMessage>No batches match this view.</StateMessage>}
          <div className={styles.actions}>
            {query.cursor && <button type="button" className={styles.secondaryBtn}
              onClick={() => load(query.eligibleOnly)}>First batch page</button>}
            {page.nextCursor && <button type="button" className={styles.secondaryBtn}
              onClick={() => load(query.eligibleOnly, page.nextCursor ?? "")}>Next batch page</button>}
          </div>
        </>}
      </section>
      <InventoryTrace />
    </div>
  </div>;
}
