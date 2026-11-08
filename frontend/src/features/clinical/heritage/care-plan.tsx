"use client";

import type { PatientOverview, TreatmentItem } from "./types";
import { Badge, panel, SectionTitle } from "./ui";

export function PatientOverviewCard({ patient }: { patient: PatientOverview }) {
  return <section className={panel} aria-label="Patient overview">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-(--heritage-parchment-muted)">{patient.id}</p><h2 className="mt-1 font-serif text-3xl">{patient.name}</h2></div><Badge>{patient.phase}</Badge></div>
    <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4"><div><dt className="text-xs text-(--heritage-parchment-muted)">Dosha</dt><dd className="mt-1 font-semibold">{patient.dosha}</dd></div>{patient.vitals.map(vital => <div key={vital.label}><dt className="text-xs text-(--heritage-parchment-muted)">{vital.label}</dt><dd className="mt-1 font-semibold">{vital.value}</dd></div>)}</dl>
  </section>;
}

export interface CarePlanProps {
  patient: PatientOverview;
  items: ReadonlyArray<TreatmentItem>;
  onCompletionChange: (id: string, completed: boolean) => void;
  disabled?: boolean;
}

export function CarePlan({ patient, items, onCompletionChange, disabled = false }: CarePlanProps) {
  const completed = items.filter(item => item.completed).length;
  return <div className="space-y-5"><PatientOverviewCard patient={patient} /><section className={panel} aria-label="Treatment schedule">
    <div className="flex flex-wrap items-start justify-between gap-3"><SectionTitle eyebrow="Daily care rhythm">Treatment schedule</SectionTitle><p role="status" className="text-sm text-(--heritage-parchment-muted)">{completed} of {items.length} completed</p></div>
    <progress aria-label="Treatment completion" value={completed} max={items.length || 1} className="mb-6 h-2 w-full accent-(--heritage-forest)" />
    <ol className="space-y-5">{items.map(item => <li key={item.id} className="grid grid-cols-[4rem_1fr] gap-3 sm:grid-cols-[5rem_1fr]"><span className="pt-3 text-sm font-semibold">{item.time}</span><label className="flex cursor-pointer items-start gap-4 rounded-xl border border-(--heritage-parchment-border) p-4 transition hover:bg-(--heritage-parchment)"><input type="checkbox" checked={item.completed} disabled={disabled} onChange={event => onCompletionChange(item.id, event.target.checked)} className="mt-1 size-5 shrink-0 accent-(--heritage-forest)" /><span><span className="block text-xs text-(--heritage-parchment-muted)">{item.category}</span><span className={`mt-1 block font-semibold ${item.completed ? "line-through opacity-60" : ""}`}>{item.title}</span><span className="mt-1 block text-sm leading-6 text-(--heritage-parchment-muted)">{item.instructions}</span></span></label></li>)}</ol>
  </section></div>;
}
