"use client";

import { useState } from "react";
import Link from "next/link";

interface DatedCorrection {
  id: string;
  timestamp: string;
  clinician: string;
  reason: string;
  note: string;
}

export function SignedConsultationView() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("clarify the date of the prior visit.");
  const [correctionNote, setCorrectionNote] = useState("The earlier visit date has been clarified. The original signed note remains unchanged.");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [corrections, setCorrections] = useState<DatedCorrection[]>([
    {
      id: "corr-1",
      timestamp: "28 Oct 2026, 10:05",
      clinician: "Dr. Anu",
      reason: "clarify the date of the prior visit.",
      note: "The earlier visit date has been clarified. The original signed note remains unchanged.",
    },
  ]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionReason.trim() || !correctionNote.trim()) return;

    const newCorrection: DatedCorrection = {
      id: `corr-${Date.now()}`,
      timestamp: new Date().toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Colombo",
      }),
      clinician: "Dr. Anu",
      reason: correctionReason.trim(),
      note: correctionNote.trim(),
    };

    setCorrections((prev) => [...prev, newCorrection]);
    setShowCorrectionModal(false);
    triggerToast("Dated correction recorded and added to immutable ledger.");
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f5ede1] text-[#1c2e24] font-sans antialiased selection:bg-[#d9e6d8] selection:text-[#143826]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#143826] text-white px-5 py-3 rounded-xl shadow-xl border border-emerald-500/30 text-sm font-medium animate-fade-in">
          <span>🌿</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile Menu Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ========================================================= */}
      {/* LEFT PERSISTENT SIDEBAR - Exact Living Heritage Figma Theme */}
      {/* ========================================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#143826] text-white flex flex-col justify-between p-6 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div>
          {/* Top Brand Logo */}
          <div className="flex items-center justify-between">
            <Link href="/clinical" className="flex items-center gap-2.5 group">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d7b98d"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L15 9H9L12 2Z" />
                <path d="M12 22V9" />
                <path d="M7 13C7 16 12 18 12 18C12 18 17 16 17 13" />
              </svg>
              <span className="text-2xl font-serif tracking-tight text-[#fdfbf7] group-hover:text-amber-100 transition-colors">
                AyurFlow
              </span>
            </Link>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden text-[#9ab7a4] hover:text-white p-1"
              aria-label="Close navigation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-widest text-[#a8b8ad] font-semibold">
              STAFF WORKSPACE
            </div>
            {/* Elegant botanical divider flourish */}
            <div className="flex items-center gap-2 mt-2 opacity-50">
              <div className="h-px bg-[#d7b98d] flex-1" />
              <svg width="22" height="10" viewBox="0 0 22 10" fill="none" stroke="#d7b98d" strokeWidth="1">
                <path d="M2 5C6 1 10 1 11 5C12 1 16 1 20 5C16 9 12 9 11 5C10 9 6 9 2 5Z" />
              </svg>
              <div className="h-px bg-[#d7b98d] flex-1" />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-8 space-y-1.5 font-medium text-sm">
            <Link
              href="/reception"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[#cad5cf] hover:text-white hover:bg-white/5 transition-colors"
            >
              <span>Overview</span>
            </Link>
            <Link
              href="/reception"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[#cad5cf] hover:text-white hover:bg-white/5 transition-colors"
            >
              <span>Assigned patients</span>
            </Link>
            <Link
              href="/clinical"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#ece5d8] text-[#143826] font-semibold shadow-xs"
            >
              <span>Consultations</span>
            </Link>
            <Link
              href="/clinical/plans"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[#cad5cf] hover:text-white hover:bg-white/5 transition-colors"
            >
              <span>Care plans</span>
            </Link>
            <Link
              href="/scheduling"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[#cad5cf] hover:text-white hover:bg-white/5 transition-colors"
            >
              <span>Sessions</span>
            </Link>
          </nav>
        </div>

        {/* Sidebar Botanical Illustration & Clinic Badge */}
        <div className="pt-8">
          <div className="flex justify-center mb-6 opacity-35">
            <svg
              width="64"
              height="110"
              viewBox="0 0 60 100"
              fill="none"
              stroke="#d7b98d"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M30 95 V 15" />
              <path d="M30 80 C 18 75 14 62 20 54 C 26 58 29 68 30 80 Z" />
              <path d="M30 65 C 42 60 46 47 40 39 C 34 43 31 53 30 65 Z" />
              <path d="M30 50 C 18 45 14 32 20 24 C 26 28 29 38 30 50 Z" />
              <path d="M30 35 C 42 30 46 17 40 9 C 34 13 31 23 30 35 Z" />
              <path d="M30 15 C 26 8 34 8 30 15 Z" />
              <ellipse cx="30" cy="94" rx="14" ry="3" />
            </svg>
          </div>

          <div className="pt-4 border-t border-emerald-900/50">
            <div className="text-[10px] tracking-widest uppercase text-[#9ab0a1] font-semibold mb-1">
              SINGLE CLINIC
            </div>
            <p className="text-xs text-[#ccd6d0] font-light leading-relaxed">
              Thoughtful care.<br />Connected records.
            </p>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MAIN CONTENT AREA */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <header className="border-b border-[#e2d7c5] px-6 lg:px-10 py-3.5 flex items-center justify-between bg-[#f8f3eb]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden text-[#143826] p-1.5 rounded-lg border border-[#e2d7c5]"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-xs md:text-sm font-medium text-[#1c2e24]">
              Consultations
            </span>
          </div>

          <div className="flex items-center gap-5 text-right">
            <span className="text-xs text-[#6b7d72] hidden sm:inline font-mono">
              28 Oct 2026 · Asia/Colombo
            </span>
            <div className="border-l border-[#e2d7c5] pl-4">
              <div className="text-xs font-semibold text-[#143826]">
                Dr. Anu · <span className="font-normal text-[#4c5c52]">Clinician</span>
              </div>
              <div className="text-[10px] text-[#7d8c82]">Staff account</div>
            </div>
          </div>
        </header>

        {/* Workspace Body */}
        <main className="flex-1 p-6 lg:p-10 max-w-6xl w-full mx-auto space-y-6">
          {/* Patient Context & Title Section */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-[#63756a] uppercase">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L15 9H9L12 2Z" />
                  <path d="M12 22V9" />
                </svg>
                <span>ASSIGNED PATIENT / DEMO-0142</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-serif text-[#143826] font-bold mt-1 tracking-tight">
                Consultation
              </h1>
              <p className="text-xs sm:text-sm text-[#5d6e63] mt-1 font-medium">
                Nimali Perera · Follow-up visit · 28 October 2026
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCorrectionModal(true)}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-[#2d4b39]/40 bg-[#fbf8f2] hover:bg-[#eae2d3] text-xs sm:text-sm font-medium text-[#143826] shadow-xs transition-colors cursor-pointer self-start"
            >
              Add dated correction
            </button>
          </div>

          {/* Quick-Info Status Bar */}
          <div className="bg-[#e4ede3] border border-[#d2ded1] rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
            <span className="font-bold text-[#143826]">Nimali Perera</span>
            <div className="flex items-center gap-6">
              <span className="text-[#3b5545] font-medium">Assigned to you</span>
              <span className="text-[#204a30] font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"></span>
                Signed record
              </span>
            </div>
          </div>

          {/* Two-Column Grid: Signed Original (Left) & Consultation History (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Wider Left Card: Signed Original */}
            <div className="lg:col-span-8 bg-[#fbf8f2] border border-[#e2d7c5] rounded-2xl p-6 lg:p-7 shadow-xs">
              {/* Card Header */}
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-serif font-bold text-[#143826]">
                  Signed original
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[#ece5d8] text-[#55635a] text-[11px] font-medium border border-[#ddd3c3]">
                  Read only
                </span>
              </div>
              <p className="text-xs text-[#6b7d72] mb-5">
                Signed by Dr. Anu · 28 Oct 2026, 09:20
              </p>

              <div className="border-t border-[#e8ded0] pt-5 space-y-6">
                {/* Visit summary */}
                <div>
                  <h3 className="text-sm font-semibold text-[#143826] mb-2">
                    Visit summary
                  </h3>
                  <p className="text-xs sm:text-sm text-[#3b4740] leading-relaxed font-sans">
                    Follow-up visit. The patient&apos;s concerns and clinician observations were recorded
                    during the consultation. This synthetic note demonstrates how the original
                    signed text is retained.
                  </p>
                </div>

                {/* Dated corrections section */}
                <div className="pt-2">
                  <h3 className="text-sm font-semibold text-[#143826] mb-3">
                    A dated correction
                  </h3>

                  <div className="space-y-3">
                    {corrections.map((corr) => (
                      <div
                        key={corr.id}
                        className="bg-[#eee7dc] border border-[#e2d7c5] rounded-xl p-4 sm:p-5 text-xs text-[#2e3d33] space-y-2 shadow-2xs"
                      >
                        <div className="font-semibold text-[#143826] text-xs">
                          {corr.timestamp} · {corr.clinician}
                        </div>
                        <p className="text-xs text-[#2a382f]">
                          <span className="font-medium text-[#143826]">Reason:</span> {corr.reason}
                        </p>
                        <p className="text-xs text-[#2a382f] leading-relaxed">
                          {corr.note}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-[#7a8a80] mt-3">
                    Corrections are added to the history; the signed original stays intact.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Card: Consultation History */}
            <div className="lg:col-span-4 bg-[#fbf8f2] border border-[#e2d7c5] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-serif font-bold text-[#143826] mb-5">
                  Consultation history
                </h2>

                <div className="space-y-4">
                  {/* Item 1: Current visit */}
                  <div className="pb-3.5 border-b border-[#e8ded0]">
                    <div className="text-xs sm:text-sm font-semibold text-[#143826]">
                      28 October 2026
                    </div>
                    <div className="mt-1">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#d8e9dc] text-[#144826] text-[11px] font-semibold">
                        Signed · Current visit
                      </span>
                    </div>
                  </div>

                  {/* Item 2: Follow-up */}
                  <div className="pb-3.5 border-b border-[#e8ded0]">
                    <div className="text-xs sm:text-sm font-semibold text-[#143826]">
                      14 October 2026
                    </div>
                    <div className="mt-1">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede6d8] text-[#5c6860] text-[11px] font-medium">
                        Signed · Follow-up
                      </span>
                    </div>
                  </div>

                  {/* Item 3: First visit */}
                  <div>
                    <div className="text-xs sm:text-sm font-semibold text-[#143826]">
                      30 September 2026
                    </div>
                    <div className="mt-1">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede6d8] text-[#5c6860] text-[11px] font-medium">
                        Signed · First visit
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Care Plan Button */}
              <div className="mt-8 pt-4 border-t border-[#e8ded0]">
                <Link
                  href="/clinical/plans"
                  className="block w-full py-2.5 px-4 rounded-xl border border-[#2d4b39]/40 bg-[#fbf8f2] hover:bg-[#eae2d3] text-center text-xs sm:text-sm font-medium text-[#143826] transition-colors shadow-2xs"
                >
                  View care plan
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modal: Add Dated Correction */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#fbf8f2] rounded-2xl border border-[#d8cbbb] max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e2d7c5] pb-3">
              <div>
                <h3 className="text-base font-serif font-bold text-[#143826]">
                  Record Dated Correction
                </h3>
                <p className="text-xs text-[#6b7d72] mt-0.5">
                  Append an immutable post-signature observation or clarification.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCorrectionModal(false)}
                className="text-[#6b7d72] hover:text-[#143826] p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCorrection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#143826] mb-1">
                  Reason for Correction
                </label>
                <input
                  type="text"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. clarify the date of the prior visit."
                  required
                  className="w-full text-xs rounded-xl border border-[#d8cbbb] p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#143826] mb-1">
                  Correction Note
                </label>
                <textarea
                  rows={3}
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="Enter the correction detail. The original signed note remains intact."
                  required
                  className="w-full text-xs rounded-xl border border-[#d8cbbb] p-3 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826] leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2d7c5]">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#d8cbbb] text-slate-700 text-xs font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#143826] hover:bg-[#1a4731] text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  Append Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
