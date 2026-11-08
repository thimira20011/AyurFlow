import type { ReactNode } from "react";

export const panel = "rounded-2xl border border-(--heritage-parchment-border) bg-(--heritage-parchment-light) p-5 sm:p-7";
export const primaryButton = "rounded-xl bg-(--heritage-forest) px-5 py-3 text-sm font-semibold text-white transition hover:bg-(--heritage-forest-dark) disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButton = "rounded-xl border border-(--heritage-parchment-border) px-5 py-3 text-sm font-semibold transition hover:bg-(--heritage-parchment) disabled:cursor-not-allowed disabled:opacity-50";

export function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-(--heritage-sage-light) px-3 py-1 text-xs font-semibold text-(--heritage-forest-dark)">{children}</span>;
}

export function SectionTitle({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return <div className="mb-5"><p className="mb-1 text-xs font-semibold tracking-[0.16em] text-(--heritage-parchment-muted) uppercase">{eyebrow}</p><h2 className="font-serif text-3xl text-(--heritage-forest)">{children}</h2></div>;
}

export function LockIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></svg>;
}

export function displayDate(instant: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" }).format(new Date(instant));
}
