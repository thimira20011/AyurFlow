"use client";

import { useRef, useState } from "react";
import type { SignedConsultation as Consultation } from "./types";
import { Badge, displayDate, LockIcon, panel, secondaryButton, SectionTitle } from "./ui";
import styles from "./signed-consultation.module.css";

export function SignedConsultation({ document }: { document: Consultation }) {
  const printable = useRef<HTMLElement>(null);
  const [message, setMessage] = useState("");

  function printDocument() {
    const source = printable.current;
    if (!source) return;
    const frame = window.document.createElement("iframe");
    frame.title = "Printable signed consultation";
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;";
    window.document.body.appendChild(frame);
    const target = frame.contentDocument;
    const view = frame.contentWindow;
    if (!target || !view) { frame.remove(); setMessage("Printing is unavailable in this browser."); return; }
    const style = target.createElement("style");
    style.textContent = "body{font:14px Georgia,serif;color:#142c22;margin:24mm;line-height:1.65}h1,h2,h3{line-height:1.3}h2{font-size:28px}section{margin:24px 0}svg{display:none}time{font-size:12px}p{white-space:pre-wrap}@page{size:A4;margin:0}";
    target.head.appendChild(style);
    target.title = document.id;
    target.body.appendChild(source.cloneNode(true));
    view.addEventListener("afterprint", () => frame.remove(), { once: true });
    view.focus();
    view.print();
  }

  function exportDocument() {
    const text = ["AyurFlow — Living Heritage", document.id, `${document.patient.name} · ${document.patient.id}`, "Chief complaints", document.chiefComplaints, "Diagnosis summary", document.diagnosis, "Doctor notes", document.doctorNotes, `Signed by ${document.signer}`, displayDate(document.signedAt) + " · Asia/Colombo", `Reference: ${document.signatureReference}`, `Verification: ${document.verification}`].join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = window.document.createElement("a");
    link.href = url; link.download = `consultation-${document.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
    window.document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Text export downloaded.");
  }

  return <section className={panel}><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><SectionTitle eyebrow="Clinical record">Signed consultation</SectionTitle><div className="flex gap-3"><button onClick={exportDocument} className={secondaryButton}>Export text</button><button onClick={printDocument} className={secondaryButton}>Print / PDF</button></div></div>
    <article ref={printable} className={`${styles.document} rounded-xl border border-(--heritage-parchment-border) bg-white/70 p-5 sm:p-10`} aria-label="Signed clinical document">
      <header className="border-b border-(--heritage-parchment-border) pb-6"><p className="text-xs tracking-[0.18em] uppercase">AyurFlow · Living Heritage</p><h2 className="mt-2 font-serif text-3xl">Consultation record</h2><p className="mt-3 text-sm">{document.id} · {document.patient.name} · {document.patient.id}</p></header>
      {[["Chief complaints", document.chiefComplaints], ["Diagnosis summary", document.diagnosis], ["Doctor notes", document.doctorNotes]].map(([title, body]) => <section key={title} className="mt-7"><h3 className="mb-2 font-serif text-xl">{title}</h3><p className="whitespace-pre-wrap text-sm leading-7">{body}</p></section>)}
      <footer className="mt-10 border-t border-(--heritage-parchment-border) pt-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-serif text-2xl italic">{document.signer}</p><p className="mt-1 text-xs">Electronic signature · {document.signatureReference}</p><time dateTime={document.signedAt} className="mt-2 block text-xs">{displayDate(document.signedAt)} · Colombo</time></div><Badge><LockIcon />{document.verification === "verified" ? "Signature verified" : document.verification === "demo" ? "Demo signature · unverified" : "Verification unavailable"}</Badge></div><p className="mt-5 text-xs text-(--heritage-parchment-muted)">Signed original · Read only</p></footer>
    </article><p role="status" className="mt-3 text-sm">{message}</p></section>;
}
