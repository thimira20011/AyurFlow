"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { APIRequestError } from "@/lib/api-client";
import { formatColombo, validPatientId } from "./validation";
import { advancePlan, approveStage, changePlanState, createPlan, getPlan, listPlans, type Plan, type PlanDetail } from "./plans-api";
import styles from "./consultation-workspace.module.css";

function errorMessage(error: unknown): string {
  if (error instanceof APIRequestError) {
    if (error.status === 401) return "Your session ended. Sign in again.";
    if (error.status === 403 || error.status === 404) return "This plan is unavailable to you.";
    if (error.status === 409) return "The plan changed or required clinical evidence is missing. Reload it before trying again.";
    if (error.status === 422) return "Check the information entered and try again.";
  }
  return "The plan service could not confirm the action. Reload before trying again.";
}

export default function PlanWorkspace({ initialPatientId = "" }: { initialPatientId?: string }) {
  const [patientInput, setPatientInput] = useState(initialPatientId);
  const [patientId, setPatientId] = useState("");
  const [items, setItems] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<PlanDetail | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [checks, setChecks] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const activeStage = selected?.stages.find(stage => stage.ordinal === selected.currentStageOrdinal);

  async function openPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = patientInput.trim();
    if (!validPatientId(id)) { setNotice("Enter a valid patient ID."); return; }
    setBusy(true); setNotice(""); setSelected(null); setItems([]); setPatientId("");
    try { setItems(await listPlans(id)); setPatientId(id); }
    catch (error) { setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function openPlan(id: string) {
    setBusy(true); setNotice(""); setSelected(null); setChecks([]);
    try { setSelected(await getPlan(id)); }
    catch (error) { setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function mutate(action: () => Promise<Plan>, success: string) {
    setBusy(true); setNotice("");
    try {
      const result = await action();
      setItems(previous => [result, ...previous.filter(item => item.id !== result.id)]);
      setSelected(await getPlan(result.id));
      setChecks([]); setReason(""); setNotice(success);
    } catch (error) { setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return <main className={styles.workspace}>
    <header className={styles.heading}>
      <p className={styles.kicker}>Clinical pathway</p>
      <h1>Care plans</h1>
      <p>Review one patient’s plan, confirm stage checks, and record clinical decisions.</p>
      <p><Link href="/clinical">Consultations</Link></p>
    </header>
    <form className={styles.patientForm} onSubmit={openPatient}>
      <div><label htmlFor="plan-patient">Patient ID</label><input id="plan-patient" value={patientInput} onChange={event => setPatientInput(event.target.value)} required /></div>
      <p>Only assigned clinicians can open or change plans.</p>
      <button disabled={busy}>Open plans</button>
    </form>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {patientId && <div className={styles.columns}>
      <section className={styles.listPanel} aria-label="Patient plans">
        <div className={styles.sectionHead}><h2>Plans</h2></div>
        {items.length === 0 ? <p>No plans are recorded for this patient.</p> : <ul className={styles.list}>
          {items.map(item => <li key={item.id}><button className={selected?.id === item.id ? styles.selected : ""} disabled={busy} onClick={() => openPlan(item.id)}>
            <strong>{item.pathwayState}</strong><span className={styles.recordId}>{item.id}</span>
          </button></li>)}
        </ul>}
        <form onSubmit={event => { event.preventDefault(); mutate(() => createPlan(patientId, sourceId.trim()), "Plan created."); }}>
          <h3>Create plan</h3>
          <label htmlFor="plan-source">Source consultation ID (optional)</label>
          <input id="plan-source" value={sourceId} onChange={event => setSourceId(event.target.value)} />
          <div className={styles.actions}><button disabled={busy}>Create plan</button></div>
        </form>
      </section>
      <section className={styles.detailPanel} aria-label="Plan details">
        {!selected ? <p>Select a plan to see its stages and decisions.</p> : <>
          <div className={styles.sectionHead}><h2>{selected.pathwayState}</h2><span className={styles.badge}>{selected.status}</span></div>
          <p className={styles.meta}>Version {selected.version} · Current stage {selected.currentStageOrdinal}</p>
          <ol>{selected.stages.map(stage => <li key={stage.id}>
            <strong>{stage.label}</strong> — {stage.status}
            <ul>{stage.requiredChecks.map(check => <li key={check}>{check}{stage.confirmedChecks.includes(check) ? " ✓" : ""}</li>)}</ul>
            {stage.approvedAt && <p className={styles.meta}>Approved {formatColombo(stage.approvedAt)}</p>}
          </li>)}</ol>
          {selected.status === "active" && activeStage?.status === "pending" && <fieldset disabled={busy}>
            <legend>Confirm {activeStage.label} checks</legend>
            {activeStage.requiredChecks.map(check => <label key={check}><input type="checkbox" checked={checks.includes(check)} onChange={event => setChecks(previous => event.target.checked ? [...previous, check] : previous.filter(value => value !== check))} /> {check}</label>)}
            <div className={styles.actions}><button disabled={busy || checks.length !== activeStage.requiredChecks.length} onClick={() => mutate(() => approveStage(selected, activeStage), "Stage approved.")}>Record approval</button></div>
          </fieldset>}
          {selected.status === "active" && activeStage?.status === "approved" && <div className={styles.actions}>
            <button disabled={busy} onClick={() => mutate(() => advancePlan(selected), "Stage advanced.")}>Advance stage</button>
          </div>}
          {(selected.status === "active" || selected.status === "held") && <form onSubmit={event => { event.preventDefault(); }}>
            <label htmlFor="plan-reason">Clinical reason</label>
            <textarea id="plan-reason" value={reason} onChange={event => setReason(event.target.value)} required minLength={3} />
            <div className={styles.actions}>
              {selected.status === "active" && <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => mutate(() => changePlanState(selected, "hold", reason), "Plan placed on hold.")}>Hold</button>}
              {selected.status === "held" && <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => mutate(() => changePlanState(selected, "resume", reason), "Plan resumed.")}>Resume</button>}
              <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => mutate(() => changePlanState(selected, "cancel", reason), "Plan cancelled.")}>Cancel plan</button>
            </div>
          </form>}
          <h3>Decision history</h3>
          {selected.decisions.length === 0 ? <p>No decisions recorded.</p> : <ul>{selected.decisions.map(decision => <li key={decision.id}>
            {decision.action} · {formatColombo(decision.recordedAt)}{decision.reason ? ` · ${decision.reason}` : ""}
          </li>)}</ul>}
        </>}
      </section>
    </div>}
  </main>;
}
