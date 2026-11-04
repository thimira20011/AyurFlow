"use client";

import { useState } from "react";
import Link from "next/link";

export type PlanStatus = "Active" | "On Hold" | "Completed" | "Cancelled";

interface Stage {
  id: string;
  number: string;
  name: string;
  subtitle: string;
  description: string;
  statusBadge: string;
  badgeType: "completed" | "current" | "locked";
  notes?: string;
}

export function CarePlanStageView() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [planStatus, setPlanStatus] = useState<PlanStatus>("Active");
  const [stage2Approved, setStage2Approved] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleApproveStage = () => {
    setStage2Approved(true);
    triggerToast("Stage 02 (Primary stage) approved by Dr. Anu. Therapy orders unlocked.");
  };

  const handleHoldPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdReason.trim()) return;
    setPlanStatus("On Hold");
    setShowHoldModal(false);
    triggerToast("Care plan placed on clinical hold.");
  };

  const handleResumePlan = () => {
    setPlanStatus("Active");
    triggerToast("Care plan resumed to Active status.");
  };

  const handleCancelPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;
    setPlanStatus("Cancelled");
    setShowCancelModal(false);
    triggerToast("Care plan has been cancelled.");
  };

  const stages: Stage[] = [
    {
      id: "stage-01",
      number: "01",
      name: "Preparatory stage",
      subtitle: "Purvakarma · Deepana, Pachana & Snehana",
      description:
        "Internal oleation and mild sudation completed to loosen metabolic toxins and prepare the patient for targeted cleansing.",
      statusBadge: "Completed · Approval recorded",
      badgeType: "completed",
      notes: "Approved by Dr. Anu on 18 Oct 2026. Digestion normalized, baseline vitals cleared.",
    },
    {
      id: "stage-02",
      number: "02",
      name: "Primary stage",
      subtitle: "Pradhanakarma · Virechana & Sthanika Basti",
      description:
        "Therapeutic purgation protocol and localized joint therapy. Requires formal clinician sign-off before session scheduling.",
      statusBadge: stage2Approved
        ? "Completed · Approval recorded"
        : "Current stage · Awaiting clinician approval",
      badgeType: stage2Approved ? "completed" : "current",
      notes: stage2Approved
        ? "Approved by Dr. Anu on 28 Oct 2026. Cleared for treatment suites."
        : "Review treatment tolerance and ensure consent before granting approval.",
    },
    {
      id: "stage-03",
      number: "03",
      name: "Recovery stage",
      subtitle: "Paschatkarma · Samsarjana Krama & Rasayana",
      description:
        "Gradual dietary step-up and rejuvenating herbal regimen to consolidate therapeutic benefits and restore strength.",
      statusBadge: stage2Approved
        ? "Current stage · Ready to initiate"
        : "Previous stage must be completed first",
      badgeType: stage2Approved ? "current" : "locked",
      notes: "Stage unlocks automatically once Primary stage therapies have concluded.",
    },
  ];

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
      {/* LEFT PERSISTENT SIDEBAR - Exact Living Heritage Theme */}
      {/* ========================================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#143826] text-white flex flex-col justify-between p-6 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div>
          {/* Top Brand Logo */}
          <div className="flex items-center justify-between">
            <Link href="/clinical/plans" className="flex items-center gap-2.5 group">
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
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[#cad5cf] hover:text-white hover:bg-white/5 transition-colors"
            >
              <span>Consultations</span>
            </Link>
            <Link
              href="/clinical/plans"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#ece5d8] text-[#143826] font-semibold shadow-xs"
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
        {/* Top Header Bar */}
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
              Care plans
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
          {/* Header Section: Title, Patient info & View consultation button */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-[#63756a] uppercase">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L15 9H9L12 2Z" />
                  <path d="M12 22V9" />
                </svg>
                <span>Nimali Perera · One ordered treatment pathway</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-serif text-[#143826] font-bold mt-1 tracking-tight">
                A clear path through care.
              </h1>
              <p className="text-xs sm:text-sm text-[#5d6e63] mt-1 font-medium">
                Panchakarma treatment protocol structured in consecutive clinical stages.
              </p>
            </div>

            <Link
              href="/clinical"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-[#2d4b39]/40 bg-[#fbf8f2] hover:bg-[#eae2d3] text-xs sm:text-sm font-medium text-[#143826] shadow-xs transition-colors self-start"
            >
              View consultation
            </Link>
          </div>

          {/* Active Plan Status Banner */}
          <div className="bg-[#e4ede3] border border-[#d2ded1] rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block animate-pulse"></span>
              <span className="text-[#1c3826] font-medium">
                Plan started 14 October 2026, status: <strong className="font-semibold">{planStatus}</strong>
              </span>
            </div>
            {planStatus === "On Hold" && (
              <button
                type="button"
                onClick={handleResumePlan}
                className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950"
              >
                Resume Plan
              </button>
            )}
          </div>

          {/* Main Grid: Left Panel (Treatment pathway) & Right Panel (Next clinical decision) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Panel: Sequential Stage Cards */}
            <div className="lg:col-span-8 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[#63756a] mb-1">
                Treatment pathway
              </div>

              {stages.map((stage) => {
                const isCurrent = stage.badgeType === "current";
                const isCompleted = stage.badgeType === "completed";

                return (
                  <div
                    key={stage.id}
                    className={`bg-[#fbf8f2] border rounded-2xl p-6 transition-all ${
                      isCurrent
                        ? "border-[#143826] shadow-sm ring-1 ring-[#143826]/10"
                        : "border-[#e2d7c5] shadow-xs"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-xl font-serif font-bold text-[#143826]">
                          {stage.number}:
                        </span>
                        <h2 className="text-lg font-serif font-bold text-[#143826]">
                          {stage.name}
                        </h2>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold self-start sm:self-auto ${
                          isCompleted
                            ? "bg-[#d8e9dc] text-[#144826]"
                            : isCurrent
                            ? "bg-[#fef3c7] text-[#92400e] border border-amber-300"
                            : "bg-[#ede6d8] text-[#6b7d72]"
                        }`}
                      >
                        {stage.statusBadge}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-[#7d8c82] mb-3">
                      {stage.subtitle}
                    </div>

                    <p className="text-xs sm:text-sm text-[#3b4740] leading-relaxed">
                      {stage.description}
                    </p>

                    {stage.notes && (
                      <div className="mt-4 pt-3 border-t border-[#e8ded0] text-xs text-[#55635a] flex items-center gap-2">
                        <span className="text-emerald-700">●</span>
                        <span>{stage.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right Panel: Next clinical decision */}
            <div className="lg:col-span-4 bg-[#fbf8f2] border border-[#e2d7c5] rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-serif font-bold text-[#143826]">
                  Next clinical decision
                </h2>
                {!stage2Approved ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[11px] font-semibold border border-amber-300">
                    Approval required
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#d8e9dc] text-[#144826] text-[11px] font-semibold">
                    Approved
                  </span>
                )}
              </div>

              <div className="text-xs sm:text-sm text-[#3b4740] leading-relaxed">
                {!stage2Approved ? (
                  <p>
                    Review the preparatory stage completion and patient vitals before unlocking
                    the primary stage therapies for booking and scheduling.
                  </p>
                ) : (
                  <p className="text-emerald-900 font-medium">
                    Stage 02 has been signed and cleared by Dr. Anu. Treatment rooms and therapist
                    duty slots can now be scheduled.
                  </p>
                )}
              </div>

              <div className="pt-2 space-y-2.5">
                {/* Approve current stage button */}
                <button
                  type="button"
                  disabled={stage2Approved || planStatus !== "Active"}
                  onClick={handleApproveStage}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#143826] hover:bg-[#1a4731] disabled:bg-[#a3b8ac] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {stage2Approved ? "Current stage approved" : "Approve current stage"}
                </button>

                {/* Place plan on hold button */}
                <button
                  type="button"
                  disabled={planStatus === "Cancelled"}
                  onClick={() => setShowHoldModal(true)}
                  className="w-full py-2 px-4 rounded-xl border border-[#2d4b39]/40 bg-[#fbf8f2] hover:bg-[#eae2d3] text-xs sm:text-sm font-medium text-[#143826] transition-colors"
                >
                  Place plan on hold
                </button>

                {/* Cancel plan link & descriptive subtext */}
                <div className="pt-4 border-t border-[#e8ded0] text-center">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className="text-xs font-semibold text-rose-800 hover:text-rose-950 underline cursor-pointer"
                  >
                    Cancel plan
                  </button>
                  <p className="text-[11px] text-[#7d8c82] mt-1.5 leading-relaxed">
                    Terminates the active care plan. Historical stages and signed consultations remain intact in the permanent record.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modal: Place Plan on Hold */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#fbf8f2] rounded-2xl border border-[#d8cbbb] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e2d7c5] pb-3">
              <h3 className="text-base font-serif font-bold text-[#143826]">
                Place Care Plan on Hold
              </h3>
              <button
                type="button"
                onClick={() => setShowHoldModal(false)}
                className="text-[#6b7d72] hover:text-[#143826] font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleHoldPlan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#143826] mb-1">
                  Reason for Hold (Required)
                </label>
                <textarea
                  rows={3}
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="e.g. Patient intercurrent illness or travel schedule..."
                  required
                  className="w-full text-xs rounded-xl border border-[#d8cbbb] p-3 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2d7c5]">
                <button
                  type="button"
                  onClick={() => setShowHoldModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#d8cbbb] text-slate-700 text-xs font-semibold hover:bg-slate-100"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-xs"
                >
                  Confirm Hold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cancel Plan */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#fbf8f2] rounded-2xl border border-[#d8cbbb] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e2d7c5] pb-3">
              <h3 className="text-base font-serif font-bold text-rose-900">
                Cancel Care Plan
              </h3>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="text-[#6b7d72] hover:text-[#143826] font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCancelPlan} className="space-y-4">
              <p className="text-xs text-[#55635a] leading-relaxed">
                Cancelling this care plan will prevent future therapy sessions from being booked. This action cannot be reversed.
              </p>

              <div>
                <label className="block text-xs font-bold text-[#143826] mb-1">
                  Cancellation Clinical Justification
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Patient contraindication discovered or medical referral required..."
                  required
                  className="w-full text-xs rounded-xl border border-[#d8cbbb] p-3 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2d7c5]">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#d8cbbb] text-slate-700 text-xs font-semibold hover:bg-slate-100"
                >
                  Keep Plan
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shadow-xs"
                >
                  Cancel Plan Permanently
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
