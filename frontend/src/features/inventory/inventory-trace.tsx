"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Notice, StateMessage } from "@/components/staff-feedback";
import { TableRegion } from "@/components/staff-table";
import { APIRequestError } from "@/lib/api-client";
import { traceBatch, tracePatient, type TraceRow } from "./api";
import styles from "./inventory-workspace.module.css";

const colomboDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short",
});

export default function InventoryTrace() {
  const [direction, setDirection] = useState<"batch" | "patient">("batch");
  const [record, setRecord] = useState("");
  const [rows, setRows] = useState<TraceRow[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setRows(null);
    setError("");
    const id = record.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      setError(`Enter a valid ${direction} ID.`);
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    try {
      const result = await (direction === "batch" ? traceBatch : tracePatient)(id, controller.signal);
      if (!controller.signal.aborted) setRows(result.items ?? []);
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError(failure instanceof APIRequestError && [403, 404].includes(failure.status)
        ? "This record is unavailable to your account."
        : "The trace could not be loaded. Try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return <section className={`${styles.panel} ${styles.fullWidth}`} aria-labelledby="live-trace-title">
    <h2 id="live-trace-title" className={styles.panelTitle}>Confirmed batch traceability</h2>
    <p className={styles.hint}>Shows up to 100 of the most recent confirmed uses for the selected batch or patient.</p>
    <form onSubmit={submit}>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="trace-type">Trace direction</label>
        <select id="trace-type" className={styles.select} value={direction} disabled={loading} onChange={event => {
          setDirection(event.target.value === "batch" ? "batch" : "patient");
          setRows(null);
          setError("");
          setRecord("");
        }}>
          <option value="batch">Batch → patients</option>
          <option value="patient">Patient → batches</option>
        </select>
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="trace-record">{direction === "batch" ? "Batch ID" : "Patient ID"}</label>
        <input id="trace-record" className={styles.input} value={record} required disabled={loading} onChange={event => {
          setRecord(event.target.value);
          setRows(null);
          setError("");
        }} />
      </div>
      <button className={styles.primaryBtn} disabled={loading}>Trace confirmed use</button>
    </form>
    {loading && <StateMessage>Loading confirmed use…</StateMessage>}
    {error && <Notice tone="error">{error}</Notice>}
    {rows?.length === 0 && <StateMessage>No confirmed use found for this record.</StateMessage>}
    {!!rows?.length && <TableRegion label="Traceability results">
      <table className={styles.table}>
        <thead><tr><th scope="col">Patient</th><th scope="col">Batch</th><th scope="col">Actual quantity</th><th scope="col">Session</th><th scope="col">Confirmed (Colombo)</th></tr></thead>
        <tbody>{rows.map(row => <tr key={`${row.preparationId}-${row.batchId}`}>
          <td>{row.patientDisplayName}<div className={styles.hint}>{row.patientId}</div></td>
          <td>{row.batchReference}</td><td>{row.quantityGrams} g</td><td>{row.sessionId}</td>
          <td>{colomboDateTime.format(new Date(row.confirmedAt))}</td>
        </tr>)}</tbody>
      </table>
    </TableRegion>}
  </section>;
}
