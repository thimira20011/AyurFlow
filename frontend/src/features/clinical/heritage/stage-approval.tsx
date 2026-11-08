"use client";

import { useRef, useState, type FormEvent } from "react";
import type { AuditEntry, ClinicalStage, ReviewDecision } from "./types";
import { Badge, displayDate, panel, primaryButton, secondaryButton, SectionTitle } from "./ui";

export interface StageApprovalProps {
  stages: ReadonlyArray<ClinicalStage>;
  audit: ReadonlyArray<AuditEntry>;
  onDecision: (stageId: string, decision: ReviewDecision, notes: string) => Promise<void>;
}

export function StageApproval({ stages, audit, onDecision }: StageApprovalProps) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const current = stages.find(stage => stage.status === "review");

  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current || pending.current) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const decision: ReviewDecision = submitter instanceof HTMLButtonElement && submitter.value === "changes_requested" ? "changes_requested" : "approved";
    if (decision === "changes_requested" && !notes.trim()) { setMessage("Add review notes before requesting changes."); return; }
    pending.current = true; setBusy(true); setMessage("");
    try {
      await onDecision(current.id, decision, notes.trim());
      setNotes(""); setMessage(decision === "approved" ? "Stage approval recorded." : "Changes requested. The stage remains in review.");
    } catch { setMessage("The decision could not be confirmed. Reload the latest stage before retrying."); }
    finally { pending.current = false; setBusy(false); }
  }

  return <div className="space-y-5"><section className={panel}><SectionTitle eyebrow="Clinical pathway">Stage review</SectionTitle>
    <ol className="grid gap-3 sm:grid-cols-3">{stages.map((stage, index) => <li key={stage.id} aria-current={stage.status === "review" ? "step" : undefined} className={`rounded-xl border p-4 ${stage.status === "review" ? "border-(--heritage-forest) bg-(--heritage-parchment)" : "border-(--heritage-parchment-border)"}`}><p className="mb-3 text-xs text-(--heritage-parchment-muted)">Stage {index + 1}</p><h3 className="mb-3 font-semibold">{stage.label}</h3><Badge>{stage.status === "complete" ? "Complete" : stage.status === "review" ? "Awaiting review" : "Upcoming"}</Badge></li>)}</ol>
  </section><div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]"><section className={panel}><SectionTitle eyebrow="Clinician decision">{current ? `Review ${current.label}` : "No pending review"}</SectionTitle><form onSubmit={decide}><fieldset disabled={busy || !current} className="space-y-4"><label htmlFor="heritage-review-notes" className="block text-sm font-semibold">Review notes <span className="font-normal">(required for changes)</span></label><textarea id="heritage-review-notes" rows={5} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} className="w-full rounded-xl border border-(--heritage-parchment-border) bg-white/60 p-3 text-sm" /><div className="flex flex-wrap gap-3"><button type="submit" name="decision" value="approved" className={primaryButton}>Approve</button><button type="submit" name="decision" value="changes_requested" className={secondaryButton}>Request Changes</button></div></fieldset><p role="status" className="mt-4 text-sm">{busy ? "Recording decision…" : message}</p></form></section>
    <section className={panel}><SectionTitle eyebrow="Decision history">Audit trail</SectionTitle>{audit.length === 0 ? <p>No decisions recorded.</p> : <ol className="space-y-5">{audit.map(entry => <li key={entry.id} className="border-l-2 border-(--heritage-sage) pl-4"><p className="text-sm font-semibold">{entry.action}</p><p className="mt-1 text-sm">{entry.actor}</p><time dateTime={entry.timestamp} className="text-xs text-(--heritage-parchment-muted)">{displayDate(entry.timestamp)} · Colombo</time></li>)}</ol>}</section></div></div>;
}
