"use client";

import { useState } from "react";
import { CarePlan } from "./care-plan";
import { StageApproval } from "./stage-approval";
import { SignedConsultation } from "./signed-consultation";
import { auditEntries, patient, signedDocument, stages, treatmentItems } from "./mock-data";
import type { ReviewDecision } from "./types";

export default function WorkspacePreview() {
  const [items, setItems] = useState(treatmentItems);
  const [workflow, setWorkflow] = useState(stages);
  const [audit, setAudit] = useState(auditEntries);

  async function recordDecision(stageId: string, decision: ReviewDecision, _notes: string) {
    // Preview only: live adapters must enforce prerequisites and persist decisions and audit atomically.
    void _notes;
    if (decision === "approved") setWorkflow(previous => previous.map(stage => stage.id === stageId ? { ...stage, status: "complete" } : stage));
    setAudit(previous => [{ id: crypto.randomUUID(), actor: "Demo clinician", action: decision === "approved" ? "Preparatory stage approved" : "Changes requested for Preparatory stage", timestamp: new Date().toISOString() }, ...previous]);
  }

  return <main className="min-h-screen bg-(--heritage-parchment) px-4 py-8 text-(--heritage-forest-dark) sm:px-8"><div className="mx-auto max-w-6xl space-y-10"><header><p className="text-xs tracking-[0.2em] uppercase">AyurFlow · Living Heritage</p><h1 className="mt-2 font-serif text-4xl sm:text-5xl">Clinical workspace</h1><p className="mt-3 text-sm text-(--heritage-parchment-muted)">Synthetic preview · Changes last for this visit only.</p><nav aria-label="Feature branches" className="mt-5 flex flex-wrap gap-5 text-sm underline underline-offset-4"><a href="#care-plan">Care plan</a><a href="#stage-approval">Stage approval</a><a href="#signed-consultation">Signed consultation</a></nav></header>
    <section id="care-plan" aria-label="Care plan branch" className="scroll-mt-6"><CarePlan patient={patient} items={items} onCompletionChange={(id, completed) => setItems(previous => previous.map(item => item.id === id ? { ...item, completed } : item))} /></section>
    <section id="stage-approval" aria-label="Stage approval branch" className="scroll-mt-6"><StageApproval stages={workflow} audit={audit} onDecision={recordDecision} /></section>
    <section id="signed-consultation" aria-label="Signed consultation branch" className="scroll-mt-6"><SignedConsultation document={signedDocument} /></section>
    </div></main>;
}
