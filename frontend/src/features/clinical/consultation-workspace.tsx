"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { APIRequestError } from "@/lib/api-client";
import {
  addCorrection, createDraft, getConsultation, listConsultations, signDraft, updateDraft,
  type Consultation, type ConsultationSummary,
} from "./api";
import { formatColombo, validClinicalText, validCorrectionReason, validPatientId } from "./validation";
import styles from "./consultation-workspace.module.css";

type Notice = { tone: "success" | "error" | "info"; text: string };

const samplePatient = "00000000-0000-4000-8000-000000000101";
const sampleClinician = "00000000-0000-4000-8000-000000000301";
const sampleRecords: Consultation[] = [
  {
    id: "00000000-0000-4000-8000-000000000401", patientId: samplePatient,
    status: "draft", version: 2, draftText: "Synthetic consultation draft for screen review.",
    createdAt: "2026-10-25T08:00:00Z", createdBy: sampleClinician,
    updatedAt: "2026-10-26T09:00:00Z", updatedBy: sampleClinician,
  },
  {
    id: "00000000-0000-4000-8000-000000000402", patientId: samplePatient,
    status: "signed", version: 3, signedText: "Synthetic signed original. It cannot be edited.",
    signedBy: sampleClinician, signedAt: "2026-10-24T06:00:00Z",
    createdAt: "2026-10-23T06:00:00Z", createdBy: sampleClinician,
    updatedAt: "2026-10-24T06:00:00Z", updatedBy: sampleClinician,
    addenda: [{ id: "00000000-0000-4000-8000-000000000501", consultationId: "00000000-0000-4000-8000-000000000402",
      authorId: sampleClinician, createdAt: "2026-10-25T07:00:00Z", reason: "Clarification", body: "Separate synthetic correction." }],
  },
];

function summary(record: Consultation): ConsultationSummary {
  const { id, patientId, status, version, createdAt, createdBy, signedAt } = record;
  return { id, patientId, status, version, createdAt, createdBy, signedAt };
}

function messageFor(error: unknown, action: "read" | "write"): string {
  if (error instanceof APIRequestError) {
    if (error.status === 401) return "Your session ended. Sign in again before continuing.";
    if (error.status === 403) return "Clinical access is unavailable for this record or action.";
    if (error.status === 404) return "This clinical record is unavailable to you.";
    if (error.status === 409) return "The record changed. Reload it before making another decision.";
    if (error.status === 422) return "Check the note fields and try again.";
  }
  return action === "write"
    ? "The action could not be confirmed. Reload the record before trying again."
    : "Clinical records could not be loaded. Check the service and try again.";
}

export default function ConsultationWorkspace({ preview = false, initialPatientId = "" }: {
  preview?: boolean;
  initialPatientId?: string;
}) {
  const previewStore = useRef<Consultation[]>(sampleRecords.map((record) => ({ ...record, addenda: record.addenda?.map((item) => ({ ...item })) })));
  const [patientInput, setPatientInput] = useState(preview ? samplePatient : initialPatientId);
  const [patientId, setPatientId] = useState(preview ? samplePatient : "");
  const [records, setRecords] = useState<ConsultationSummary[]>(preview ? sampleRecords.map(summary) : []);
  const [selected, setSelected] = useState<Consultation | null>(preview ? sampleRecords[0] : null);
  const [draftText, setDraftText] = useState(preview ? sampleRecords[0].draftText ?? "" : "");
  const [reason, setReason] = useState("");
  const [correctionBody, setCorrectionBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmSign, setConfirmSign] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const dirtyDraft = selected?.status === "draft" && draftText !== (selected.draftText ?? "");

  function showRecord(record: Consultation) {
    setSelected(record);
    setDraftText(record.status === "draft" ? record.draftText ?? "" : "");
    setReason("");
    setCorrectionBody("");
    setCreating(false);
    setConfirmSign(false);
    setConflicted(false);
  }

  function replaceSummary(record: Consultation) {
    setRecords((previous) => [summary(record), ...previous.filter((item) => item.id !== record.id)]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
  }

  function handleFailure(error: unknown, action: "read" | "write") {
    if (error instanceof APIRequestError && [401, 403, 404].includes(error.status)) {
      setSelected(null);
      setDraftText("");
      setRecords([]);
      setPatientId("");
    }
    if (action === "write" && !(error instanceof APIRequestError && error.status === 422)) setConflicted(true);
    setNotice({ tone: "error", text: messageFor(error, action) });
  }

  async function openPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = patientInput.trim();
    if (!validPatientId(id)) {
      setNotice({ tone: "error", text: "Enter a valid patient ID." });
      return;
    }
    setBusy(true);
    setSelected(null);
    setRecords([]);
    setPatientId("");
    setNotice(null);
    try {
      const items = preview ? (id === samplePatient ? previewStore.current.map(summary) : []) : await listConsultations(id);
      setPatientId(id);
      setRecords(items);
      setCreating(false);
      setConflicted(false);
      if (preview && items.length) showRecord(previewStore.current[0]);
    } catch (error) {
      handleFailure(error, "read");
    } finally {
      setBusy(false);
    }
  }

  async function openConsultation(id: string) {
    setBusy(true);
    setSelected(null);
    setDraftText("");
    setNotice(null);
    try {
      const record = preview ? previewStore.current.find((item) => item.id === id) : await getConsultation(id);
      if (!record) throw new APIRequestError(404, "not_found", "Record unavailable.");
      showRecord(record);
      replaceSummary(record);
    } catch (error) {
      handleFailure(error, "read");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validClinicalText(draftText)) {
      setNotice({ tone: "error", text: "Enter a note of no more than 65,536 UTF-8 bytes." });
      return;
    }
    if (!patientId || conflicted) return;
    setBusy(true);
    setNotice(null);
    try {
      const record = preview
        ? {
            ...(creating || !selected ? {
              id: crypto.randomUUID(), patientId, createdAt: new Date().toISOString(), createdBy: sampleClinician, version: 0,
            } : selected),
            status: "draft" as const, draftText, version: creating || !selected ? 1 : selected.version + 1,
            updatedAt: new Date().toISOString(), updatedBy: sampleClinician,
          }
        : creating || !selected
          ? await createDraft(patientId, draftText)
          : await updateDraft(selected.id, selected.version, draftText);
      if (preview) {
        previewStore.current = [record, ...previewStore.current.filter((item) => item.id !== record.id)];
      }
      showRecord(record);
      replaceSummary(record);
      setNotice({ tone: "success", text: "Draft saved." });
    } catch (error) {
      handleFailure(error, "write");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSignature() {
    if (!selected || selected.status !== "draft" || conflicted || dirtyDraft) return;
    setBusy(true);
    setNotice(null);
    try {
      const record: Consultation = preview ? {
        ...selected, status: "signed", draftText: undefined, signedText: selected.draftText,
        signedBy: sampleClinician, signedAt: new Date().toISOString(), version: selected.version + 1,
        updatedAt: new Date().toISOString(), updatedBy: sampleClinician,
      } : await signDraft(selected.id, selected.version);
      if (preview) previewStore.current = previewStore.current.map((item) => item.id === record.id ? record : item);
      showRecord(record);
      replaceSummary(record);
      setNotice({ tone: "success", text: "Consultation signed. The original is now read-only." });
    } catch (error) {
      handleFailure(error, "write");
    } finally {
      setBusy(false);
    }
  }

  async function saveCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validCorrectionReason(reason) || !validClinicalText(correctionBody)) {
      setNotice({ tone: "error", text: "Enter a reason (up to 2,048 bytes) and correction (up to 65,536 bytes)." });
      return;
    }
    if (!selected || selected.status !== "signed" || conflicted) return;
    setBusy(true);
    setNotice(null);
    try {
      const addendum = preview ? {
        id: crypto.randomUUID(), consultationId: selected.id, authorId: sampleClinician,
        createdAt: new Date().toISOString(), reason, body: correctionBody,
      } : await addCorrection(selected.id, reason, correctionBody);
      const record = { ...selected, addenda: [...(selected.addenda ?? []), addendum] };
      if (preview) previewStore.current = previewStore.current.map((item) => item.id === record.id ? record : item);
      setSelected(record);
      setReason("");
      setCorrectionBody("");
      setNotice({ tone: "success", text: "Dated correction added. The signed original is unchanged." });
    } catch (error) {
      handleFailure(error, "write");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.workspace}>
      {preview && <div className={styles.preview} role="status"><strong>Synthetic screen preview</strong><span>Preview actions use browser memory only. No clinical API or database is used.</span><Link href="/clinical">Live workspace</Link></div>}
      <header className={styles.heading}>
        <div><p className={styles.kicker}>Clinical records</p><h1>Consultations</h1><p>Work with permitted drafts, signed originals, and dated corrections.</p></div>
      </header>
      <form className={styles.patientForm} onSubmit={(event) => { void openPatient(event); }}>
        <div><label htmlFor="consultation-patient-id">Patient ID</label><p>Enter a patient ID from an authorized clinical handoff.</p></div>
        <input id="consultation-patient-id" value={patientInput} onChange={(event) => setPatientInput(event.target.value)} autoComplete="off" spellCheck={false} disabled={busy} />
        <button type="submit" disabled={busy}>{busy ? "Loading…" : "Open patient"}</button>
      </form>
      {notice && <p className={`${styles.notice} ${styles[notice.tone]}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
      {patientId ? <p className={styles.context}>Patient ID <strong>{patientId}</strong> · Clinical text is available only after backend record checks.</p> : <p className={styles.context}>No patient opened. Clinical records stay hidden until access is checked.</p>}
      <div className={styles.columns}>
        <section className={styles.listPanel} aria-labelledby="consultation-list-heading">
          <div className={styles.sectionHead}><h2 id="consultation-list-heading">History</h2><button type="button" onClick={() => { setCreating(true); setSelected(null); setDraftText(""); setConflicted(false); setNotice(null); }} disabled={!patientId || busy}>New draft</button></div>
          {!patientId ? <p className={styles.empty}>Open a permitted patient to see consultations.</p> : records.length === 0 ? <p className={styles.empty}>No consultations are available for this patient. A draft does not require a care plan.</p> : (
            <ul className={styles.list}>{records.map((item) => <li key={item.id}><button type="button" className={selected?.id === item.id ? styles.selected : ""} onClick={() => { void openConsultation(item.id); }} disabled={busy} aria-pressed={selected?.id === item.id}>
              <span className={styles.listTop}><strong>{item.status === "signed" ? "Signed" : "Draft"}</strong><time>{formatColombo(item.signedAt ?? item.createdAt)}</time></span>
              <span className={styles.recordId}>{item.id}</span>
            </button></li>)}</ul>
          )}
          <p className={styles.hint}>History rows show status and dates only. Clinical text stays in authorized detail.</p>
        </section>
        <section className={styles.detailPanel} aria-labelledby="consultation-detail-heading">
          {creating || selected?.status === "draft" ? <>
            <div className={styles.sectionHead}><div><p className={styles.kicker}>Draft</p><h2 id="consultation-detail-heading">{creating ? "New consultation" : "Edit consultation"}</h2></div>{selected && !creating && <span className={styles.badge}>Version {selected.version}</span>}</div>
            <p className={styles.hint}>Save a draft before signing. A care plan is not required.</p>
            <form onSubmit={(event) => { void saveDraft(event); }}>
              <label htmlFor="consultation-draft">Clinical note</label>
              <textarea id="consultation-draft" value={draftText} onChange={(event) => setDraftText(event.target.value)} rows={11} disabled={busy || conflicted} required aria-describedby="draft-help" />
              <p id="draft-help" className={styles.hint}>Up to 65,536 UTF-8 bytes. Save uses the current record version.</p>
              <div className={styles.actions}><button type="submit" disabled={busy || conflicted || !patientId}>{busy ? "Saving…" : "Save draft"}</button>{!creating && <button className={styles.secondary} type="button" disabled={busy || conflicted || dirtyDraft} onClick={() => setConfirmSign(true)}>Review and sign</button>}{conflicted && selected && <button className={styles.secondary} type="button" onClick={() => { void openConsultation(selected.id); }} disabled={busy}>Reload record</button>}</div>
            </form>
            {dirtyDraft && <p className={styles.hint}>Save your changes before signing this draft.</p>}
            {confirmSign && selected && !creating && !dirtyDraft && <div className={styles.confirm} role="group" aria-label="Confirm signing"><strong>Sign this version?</strong><p>The original text becomes read-only. Later corrections must be separate dated addenda.</p><div className={styles.actions}><button type="button" onClick={() => { void confirmSignature(); }} disabled={busy || conflicted}>Confirm signature</button><button className={styles.secondary} type="button" onClick={() => setConfirmSign(false)} disabled={busy}>Keep editing</button></div></div>}
          </> : selected?.status === "signed" ? <>
            <div className={styles.sectionHead}><div><p className={styles.kicker}>Signed history</p><h2 id="consultation-detail-heading">Signed original</h2></div><span className={styles.badge}>Read-only</span></div>
            <p className={styles.meta}>Signed {formatColombo(selected.signedAt)} · Clinician {selected.signedBy ?? "Not recorded"}</p>
            <div className={styles.signedText}>{selected.signedText ?? "Original text unavailable."}</div>
            <h3>Dated addenda</h3>
            {!selected.addenda?.length ? <p className={styles.empty}>No corrections have been added.</p> : <ol className={styles.addenda}>{[...selected.addenda].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map((item) => <li key={item.id}><p className={styles.meta}>{formatColombo(item.createdAt)} · Clinician {item.authorId}</p><strong>Reason: {item.reason}</strong><p className={styles.addendumBody}>{item.body}</p></li>)}</ol>}
            <form onSubmit={(event) => { void saveCorrection(event); }} className={styles.correctionForm}>
              <h3>Add a correction</h3><p className={styles.hint}>A correction is appended. The signed original never changes.</p>
              <label htmlFor="correction-reason">Reason</label><input id="correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy || conflicted} required />
              <label htmlFor="correction-body">Correction</label><textarea id="correction-body" value={correctionBody} onChange={(event) => setCorrectionBody(event.target.value)} rows={5} disabled={busy || conflicted} required />
              <div className={styles.actions}><button type="submit" disabled={busy || conflicted}>{busy ? "Saving…" : "Add dated correction"}</button>{conflicted && <button className={styles.secondary} type="button" onClick={() => { void openConsultation(selected.id); }} disabled={busy}>Reload record</button>}</div>
            </form>
          </> : <div><h2 id="consultation-detail-heading">Select a consultation</h2><p className={styles.empty}>Choose a history entry or start a draft. Signed text is never shown in the list.</p></div>}
        </section>
      </div>
    </div>
  );
}
