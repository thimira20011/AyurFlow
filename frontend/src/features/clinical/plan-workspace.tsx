"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { APIRequestError } from "@/lib/api-client";
import { formatColombo, validPatientId } from "./validation";
import { advancePlan, approveStage, changePlanState, createPlan, getPlan, listPlans, startPlan, type Plan, type PlanDetail } from "./plans-api";
import styles from "./consultation-workspace.module.css";

function errorMessage(error: unknown): string {
  if (error instanceof APIRequestError) {
    if (error.status === 401) return "Your session ended. Sign in again.";
    if (error.status === 403 || error.status === 404) return "This plan is unavailable to you.";
    if (error.status === 409) return "The plan changed or required clinical evidence is missing. Select the plan again before trying another action.";
    if (error.status === 422) return "Check the information entered and try again.";
  }
  return "The plan service could not confirm the action. Reload before trying again.";
}

function stateLabel(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, letter => letter.toUpperCase());
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
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<"hold" | "cancel" | null>(null);
  const activeStage = selected?.stages.find(stage => stage.ordinal === selected.currentStageOrdinal);

  async function openPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = patientInput.trim();
    if (!validPatientId(id)) { setNoticeIsError(true); setNotice("Enter a valid patient ID."); return; }
    setBusy(true); setNotice(""); setSelected(null); setItems([]); setPatientId(""); setPendingDecision(null);
    try { setItems(await listPlans(id)); setPatientId(id); }
    catch (error) { setNoticeIsError(true); setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function openPlan(id: string) {
    setBusy(true); setNotice(""); setSelected(null); setChecks([]); setPendingDecision(null); setReason("");
    try { setSelected(await getPlan(id)); }
    catch (error) { setNoticeIsError(true); setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function mutate(action: () => Promise<Plan>, success: string) {
    setBusy(true); setNotice(""); setPendingDecision(null);
    try {
      const result = await action();
      setItems(previous => [result, ...previous.filter(item => item.id !== result.id)]);
      setSelected(null);
      try {
        setSelected(await getPlan(result.id));
        setChecks([]); setReason(""); setNoticeIsError(false); setNotice(success);
      } catch {
        setNoticeIsError(true);
        setNotice("The action may have completed, but the updated plan could not be loaded. Select the plan again before continuing.");
      }
    } catch (error) {
      if (error instanceof APIRequestError && [401, 403, 404, 409].includes(error.status)) setSelected(null);
      setNoticeIsError(true); setNotice(errorMessage(error));
    }
    finally { setBusy(false); }
  }

  return <div className={`${styles.workspace} ${styles.planWorkspace}`}>
    <header className={styles.heading}>
      <div><p className={styles.kicker}>Care plan {patientId ? `/ ${patientId}` : ""}</p>
      <h1>A clear path through care.</h1>
      <p>One ordered treatment pathway. Review its stage and record clinical decisions.</p></div>
      <Link className={styles.headingAction} href={patientId ? `/clinical?patientId=${encodeURIComponent(patientId)}` : "/clinical"}>View consultation</Link>
    </header>
    <form className={styles.patientForm} onSubmit={openPatient}>
      <div><label htmlFor="plan-patient">Patient ID</label><input id="plan-patient" value={patientInput} onChange={event => setPatientInput(event.target.value)} disabled={busy} required /></div>
      <p>Only assigned clinicians can open or change plans.</p>
      <button disabled={busy}>Open plans</button>
    </form>
    {notice && <p className={`${styles.notice} ${noticeIsError ? styles.error : styles.success}`} role={noticeIsError ? "alert" : "status"}>{notice}</p>}
    {patientId && <div className={styles.columns}>
      <section className={styles.listPanel} aria-label="Patient plans">
        <div className={styles.sectionHead}><h2>Plans</h2></div>
        {items.length === 0 ? <p>No plans are recorded for this patient.</p> : <ul className={styles.list}>
          {items.map(item => <li key={item.id}><button className={selected?.id === item.id ? styles.selected : ""} disabled={busy} onClick={() => openPlan(item.id)}>
            <strong>{stateLabel(item.pathwayState)}</strong><span className={styles.recordId}>{item.id}</span>
          </button></li>)}
        </ul>}
        <details className={styles.createPlan} open={items.length === 0}><summary>Create plan</summary><form onSubmit={event => { event.preventDefault(); mutate(() => createPlan(patientId, sourceId.trim()), "Plan created."); }}>
          <label htmlFor="plan-source">Source consultation ID (optional)</label>
          <input id="plan-source" value={sourceId} onChange={event => setSourceId(event.target.value)} disabled={busy} />
          <div className={styles.actions}><button disabled={busy}>Create plan</button></div>
        </form></details>
      </section>
      <section className={styles.detailPanel} aria-label="Plan details">
        {!selected ? <p>Select a plan to see its stages and decisions.</p> : <>
          <div className={styles.sectionHead}><h2>Treatment plan · {stateLabel(selected.pathwayState)}</h2><span className={styles.badge}>{stateLabel(selected.status)}</span></div>
          <p className={styles.meta}>Version {selected.version} · {selected.currentStageOrdinal === 0 ? "Not started" : `Current stage ${selected.currentStageOrdinal}`}</p>
          <div className={styles.planGrid}><section className={styles.pathwayPanel} aria-label="Treatment pathway"><h2>Treatment pathway</h2>
          <p className={styles.hint}>Completed stages and their recorded approvals remain visible.</p>
          <ol className={styles.stageList} aria-label="Pathway stages">{selected.stages.map(stage => <li className={styles.stageItem} key={stage.id} aria-current={stage.ordinal === selected.currentStageOrdinal ? "step" : undefined}>
            <span className={styles.stageNumber} aria-hidden="true">{String(stage.ordinal).padStart(2, "0")}</span>
            <div className={styles.stageBody}>
              <div className={styles.stageHead}><strong>{stateLabel(stage.label)} stage</strong><span className={styles.stageStatus}>{stateLabel(stage.status)}</span></div>
              <ul className={styles.checkList}>{stage.requiredChecks.map(check => <li key={check}><span aria-hidden="true">{stage.confirmedChecks.includes(check) ? "✓" : "○"}</span>{check}</li>)}</ul>
              {stage.approvedAt && <p className={styles.meta}>Approved {formatColombo(stage.approvedAt)}</p>}
              {stage.completedAt && <p className={styles.meta}>Completed {formatColombo(stage.completedAt)}</p>}
            </div>
          </li>)}</ol></section><section className={styles.decisionPanel} aria-label="Next clinical decision"><h2>Next clinical decision</h2><span className={styles.badge}>{selected.status === "held" ? "Plan on hold" : activeStage?.status === "approved" ? "Stage approved" : "Approval required"}</span>
          {selected.status === "draft" && <div className={styles.actions}>
            <button disabled={busy} onClick={() => mutate(() => startPlan(selected), "Preparatory stage started.")}>Start preparatory stage</button>
          </div>}
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
            <textarea id="plan-reason" value={reason} onChange={event => setReason(event.target.value)} disabled={busy} required minLength={3} />
            <div className={styles.actions}>
              {selected.status === "active" && <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => setPendingDecision("hold")}>Hold</button>}
              {selected.status === "held" && <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => mutate(() => changePlanState(selected, "resume", reason), "Plan resumed.")}>Resume</button>}
              <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => setPendingDecision("cancel")}>Cancel plan</button>
            </div>
            {pendingDecision && <div className={styles.confirm} role="group" aria-label={`Confirm ${pendingDecision}`}>
              <strong>{pendingDecision === "hold" ? "Place this plan on hold?" : "Cancel this plan permanently?"}</strong>
              <p>{pendingDecision === "hold" ? "New session starts and stage advancement will stop. Existing approvals and history remain." : "Cancellation is final. Future unstarted sessions must be cancelled; delivered history remains."}</p>
              <div className={styles.actions}>
                <button type="button" disabled={busy} onClick={() => mutate(() => changePlanState(selected, pendingDecision, reason.trim()), pendingDecision === "hold" ? "Plan placed on hold." : "Plan cancelled.")}>Confirm {pendingDecision}</button>
                <button className={styles.secondary} type="button" disabled={busy} onClick={() => setPendingDecision(null)}>Keep plan</button>
              </div>
            </div>}
          </form>}
          <h3>Decision history</h3>
          {selected.decisions.length === 0 ? <p>No decisions recorded.</p> : <ul className={styles.decisionList}>{selected.decisions.map(decision => <li key={decision.id}>
            <strong>{stateLabel(decision.action)}</strong><span>{formatColombo(decision.recordedAt)} · Clinician {decision.actorId}</span>
            {decision.reason && <p>{decision.reason}</p>}
          </li>)}</ul>}</section></div>
        </>}
      </section>
    </div>}
  </div>;
}
