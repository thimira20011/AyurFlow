"use client";

import { useState } from "react";
import Link from "next/link";

export type PlanStatus = "active" | "held" | "completed" | "cancelled";
export type StageStatus = "completed" | "current" | "future";

interface PlanStage {
  ordinal: number;
  name: string;
  sanskritName: string;
  description: string;
  status: StageStatus;
  approvedBy?: string;
  approvedAt?: string;
  completedAt?: string;
  therapies: Array<{ name: string; duration: string; roomType: string }>;
  checklist: Array<{ id: string; label: string; checked: boolean }>;
}

interface DecisionLog {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  decision: string;
  notes?: string;
}

export function CarePlanStageView() {
  const [planStatus, setPlanStatus] = useState<PlanStatus>("active");
  const [currentStageOrdinal, setCurrentStageOrdinal] = useState(2);
  const [holdReason, setHoldReason] = useState("");
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [stages, setStages] = useState<PlanStage[]>([
    {
      ordinal: 1,
      name: "Purvakarma (Preparatory Stage)",
      sanskritName: "Deepana, Pachana, Snehana & Swedana",
      description: "Internal oleation with medicated ghee followed by full-body herbal oil massage and steam therapy to mobilize accumulated doshas.",
      status: "completed",
      approvedBy: "Dr. Ananya Sharma",
      approvedAt: "2026-10-21T09:30:00+05:30",
      completedAt: "2026-10-23T16:00:00+05:30",
      therapies: [
        { name: "Snehapana (Internal Medicated Ghee)", duration: "3 Days", roomType: "Consultation / Observation" },
        { name: "Sarvanga Abhyanga (Herbal Oil Massage)", duration: "60 mins", roomType: "Droni Suite 01" },
        { name: "Bashpa Sweda (Herbal Steam Box)", duration: "20 mins", roomType: "Swedana Chamber" },
      ],
      checklist: [
        { id: "c1-1", label: "Deepana-Pachana herbs administered & Agni ignited", checked: true },
        { id: "c1-2", label: "Samyak Snigdha Lakshana (Proper oleation signs) observed", checked: true },
        { id: "c1-3", label: "No loose bowels or acute indigestion reported", checked: true },
      ],
    },
    {
      ordinal: 2,
      name: "Pradhanakarma (Primary Shodhana Cleanse)",
      sanskritName: "Virechana Karma & Sthanika Basti",
      description: "Therapeutic purgation to expel vitiated Pitta and mobilised toxins, accompanied by localized knee Janu Basti for Sandhigata Vata.",
      status: "current",
      approvedBy: "Dr. Ananya Sharma",
      approvedAt: "2026-10-24T11:45:00+05:30",
      therapies: [
        { name: "Virechana Aushadha (Trivrit Leha)", duration: "Single protocol day", roomType: "Observation Suite" },
        { name: "Janu Basti (Warm Medicated Oil Ring)", duration: "45 mins daily", roomType: "Droni Suite 02" },
        { name: "Patra Pinda Sweda (Elakizhi)", duration: "45 mins", roomType: "Droni Suite 01" },
      ],
      checklist: [
        { id: "c2-1", label: "Vitals check (BP < 140/90, Pulse regular)", checked: true },
        { id: "c2-2", label: "Virechana Vega (Purgation bouts) monitored & recorded", checked: true },
        { id: "c2-3", label: "Post-cleansing light rice gruel (Peya) tolerated", checked: false },
        { id: "c2-4", label: "Knee joint flexibility re-evaluated post Janu Basti", checked: false },
      ],
    },
    {
      ordinal: 3,
      name: "Paschatkarma (Restorative & Rasayana)",
      sanskritName: "Samsarjana Krama & Rejuvenation",
      description: "Gradual dietetic rehabilitation followed by restorative Rasayana herbs to rebuild digestive fire, muscle strength, and vital Ojas.",
      status: "future",
      therapies: [
        { name: "Samsarjana Krama Dietary Regimen", duration: "3 Days", roomType: "Outpatient / Dietary" },
        { name: "Navarakizhi (Shashtika Shali Pinda Sweda)", duration: "60 mins", roomType: "Droni Suite 01" },
        { name: "Rasayana Herbal Administration", duration: "14 Days", roomType: "Home Dispensary" },
      ],
      checklist: [
        { id: "c3-1", label: "Stage 2 Virechana and Basti fully completed without complications", checked: false },
        { id: "c3-2", label: "Prakruta Agni (Normal digestive fire) restored", checked: false },
        { id: "c3-3", label: "Discharge instructions & long-term lifestyle protocol reviewed", checked: false },
      ],
    },
  ]);

  const [decisionHistory, setDecisionHistory] = useState<DecisionLog[]>([
    {
      id: "dec-1",
      timestamp: "2026-10-21 09:30 (Asia/Colombo)",
      actor: "Dr. Ananya Sharma",
      role: "Lead Ayurvedic Clinician",
      decision: "Care Plan Created & Stage 1 (Purvakarma) Approved",
      notes: "Baseline vitals clear. Snehapana started with Dhanwantaram Ghritham.",
    },
    {
      id: "dec-2",
      timestamp: "2026-10-23 16:00 (Asia/Colombo)",
      actor: "Dr. Ananya Sharma",
      role: "Lead Ayurvedic Clinician",
      decision: "Stage 1 Marked Completed",
      notes: "Optimal oleation signs achieved without complications.",
    },
    {
      id: "dec-3",
      timestamp: "2026-10-24 11:45 (Asia/Colombo)",
      actor: "Dr. Ananya Sharma",
      role: "Lead Ayurvedic Clinician",
      decision: "Stage 2 (Pradhanakarma) Approved & Activated",
      notes: "Cleared for Virechana protocol. Room bookings initiated.",
    },
  ]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleChecklist = (stageOrdinal: number, checkId: string) => {
    setStages((prev) =>
      prev.map((stage) => {
        if (stage.ordinal !== stageOrdinal) return stage;
        return {
          ...stage,
          checklist: stage.checklist.map((item) =>
            item.id === checkId ? { ...item, checked: !item.checked } : item
          ),
        };
      })
    );
  };

  const handleApproveCurrentStage = () => {
    const stage = stages.find((s) => s.ordinal === currentStageOrdinal);
    if (!stage) return;

    const newLog: DecisionLog = {
      id: `dec-${Date.now()}`,
      timestamp: new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" }),
      actor: "Dr. Ananya Sharma",
      role: "Lead Ayurvedic Clinician",
      decision: `Stage ${stage.ordinal} Clinically Re-Approved & Verified`,
      notes: "Pre-procedure clearance confirmed. Therapists authorized to deliver scheduled sessions.",
    };

    setDecisionHistory((prev) => [newLog, ...prev]);
    triggerToast(`Stage ${stage.ordinal} successfully approved with clinician sign-off.`);
  };

  const handleAdvanceStage = () => {
    if (currentStageOrdinal >= stages.length) {
      setPlanStatus("completed");
      triggerToast("All Panchakarma stages completed! Care plan marked completed.");
      return;
    }

    const nextOrdinal = currentStageOrdinal + 1;
    setStages((prev) =>
      prev.map((s) => {
        if (s.ordinal === currentStageOrdinal) {
          return {
            ...s,
            status: "completed",
            completedAt: new Date().toISOString(),
          };
        }
        if (s.ordinal === nextOrdinal) {
          return {
            ...s,
            status: "current",
            approvedBy: "Dr. Ananya Sharma",
            approvedAt: new Date().toISOString(),
          };
        }
        return s;
      })
    );

    setCurrentStageOrdinal(nextOrdinal);
    const newLog: DecisionLog = {
      id: `dec-${Date.now()}`,
      timestamp: new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" }),
      actor: "Dr. Ananya Sharma",
      role: "Lead Ayurvedic Clinician",
      decision: `Advanced to Stage ${nextOrdinal}`,
      notes: `Stage ${currentStageOrdinal} completed. Cleared for Stage ${nextOrdinal} procedures.`,
    };
    setDecisionHistory((prev) => [newLog, ...prev]);
    triggerToast(`Advanced to Stage ${nextOrdinal}! Stage is now active.`);
  };

  const handlePutOnHold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdReason.trim()) return;

    setPlanStatus("held");
    setShowHoldModal(false);
    const newLog: DecisionLog = {
      id: `dec-${Date.now()}`,
      timestamp: new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" }),
      actor: "Dr. Ananya Sharma",
      role: "Lead Ayurvedic Clinician",
      decision: "Care Plan Placed on Clinical HOLD",
      notes: `Reason: ${holdReason.trim()}. New session starts and advancement are blocked.`,
    };
    setDecisionHistory((prev) => [newLog, ...prev]);
    setHoldReason("");
    triggerToast("Care plan placed on HOLD. Session starts are blocked.");
  };

  const handleResumePlan = () => {
    setPlanStatus("active");
    const newLog: DecisionLog = {
      id: `dec-${Date.now()}`,
      timestamp: new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" }),
      actor: "Dr. Ananya Sharma",
      role: "Lead Ayurvedic Clinician",
      decision: "Care Plan Resumed",
      notes: "Clinical review completed. Contraindications resolved. Scheduled sessions may proceed.",
    };
    setDecisionHistory((prev) => [newLog, ...prev]);
    triggerToast("Care plan resumed! Active sessions are cleared to start.");
  };

  const handleCancelPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;

    setPlanStatus("cancelled");
    setShowCancelModal(false);
    const newLog: DecisionLog = {
      id: `dec-${Date.now()}`,
      timestamp: new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" }),
      actor: "Dr. Ananya Sharma",
      role: "Lead Ayurvedic Clinician",
      decision: "Care Plan CANCELLED",
      notes: `Cancellation reason: ${cancelReason.trim()}. Future sessions cancelled.`,
    };
    setDecisionHistory((prev) => [newLog, ...prev]);
    setCancelReason("");
    triggerToast("Care plan cancelled.");
  };

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#1c2e24] pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#143826] text-white px-5 py-3.5 rounded-xl shadow-xl border border-emerald-500/30 text-sm font-medium animate-fade-in">
          <span>🌿</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <header className="border-b border-[#2d513e]/15 bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/reception"
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/60 transition"
            >
              <span>🌿</span>
              <span>Reception Desk</span>
            </Link>
            <span className="text-[#96a79e] text-xs">/</span>
            <Link
              href="/clinical"
              className="text-xs font-semibold text-slate-600 hover:text-emerald-900 transition"
            >
              Signed Consultation
            </Link>
            <span className="text-[#96a79e] text-xs">/</span>
            <span className="text-xs font-bold text-[#143826] bg-emerald-100/70 px-2 py-0.5 rounded">
              Care Plan & Stage Approval
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/scheduling"
              className="text-xs font-bold px-4 py-2 rounded-xl bg-white text-[#143826] border border-[#143826]/25 hover:bg-emerald-50 shadow-xs transition"
            >
              📅 Room & Therapist Schedule →
            </Link>
            <Link
              href="/clinical"
              className="text-xs font-bold px-4 py-2 rounded-xl bg-[#143826] text-white hover:bg-[#1a4732] shadow-sm transition"
            >
              ← Back to Consultation
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Care Plan Header Card */}
        <section className="bg-white rounded-2xl border border-[#2d513e]/15 shadow-sm p-6 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                {planStatus === "active" && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#143826] text-white flex items-center gap-1.5 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Plan Active · Stage {currentStageOrdinal} Cleared</span>
                  </span>
                )}
                {planStatus === "held" && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-600 text-white flex items-center gap-1.5 shadow-xs">
                    <span>⏸</span>
                    <span>Plan on Hold · Session Starts Blocked</span>
                  </span>
                )}
                {planStatus === "completed" && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs">
                    <span>✓</span>
                    <span>All Stages Completed</span>
                  </span>
                )}
                {planStatus === "cancelled" && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-700 text-white flex items-center gap-1.5 shadow-xs">
                    <span>✕</span>
                    <span>Care Plan Cancelled</span>
                  </span>
                )}
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
                  Vata-Pitta Prakriti
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Plan ID: PLN-2026-0082
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#143826] tracking-tight">
                7-Day Classical Shodhana & Shamana Panchakarma Protocol
              </h1>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-5 mt-2 text-xs text-slate-600">
                <span>
                  <strong>Patient:</strong> Saman Kumara Jayawardena (AYUR-2026-0042)
                </span>
                <span>
                  <strong>Lead Clinician:</strong> Dr. Ananya Sharma, BAMS
                </span>
                <span>
                  <strong>Linked Consultation:</strong> CLN-AYUR-2026-0894 (Signed)
                </span>
                <span>
                  <strong>Duration:</strong> 7 Treatment Days · 3 Stages
                </span>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
              {planStatus === "active" && (
                <>
                  <button
                    type="button"
                    onClick={handleApproveCurrentStage}
                    className="text-xs font-bold px-4 py-2.5 rounded-xl bg-[#143826] text-white hover:bg-[#1a4732] shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    <span>✓</span>
                    <span>Approve Stage {currentStageOrdinal}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAdvanceStage}
                    className="text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    <span>➔</span>
                    <span>Advance to Next Stage</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHoldModal(true)}
                    className="text-xs font-semibold px-4 py-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition"
                  >
                    ⏸ Put Plan on Hold
                  </button>
                </>
              )}

              {planStatus === "held" && (
                <>
                  <button
                    type="button"
                    onClick={handleResumePlan}
                    className="text-xs font-bold px-4 py-2.5 rounded-xl bg-[#143826] text-white hover:bg-[#1a4732] shadow-sm transition"
                  >
                    ▶ Resume Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className="text-xs font-semibold px-4 py-2 rounded-xl bg-red-50 text-red-900 border border-red-300 hover:bg-red-100 transition"
                  >
                    ✕ Cancel Plan
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Hold Notice Banner */}
          {planStatus === "held" && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-300/80 text-xs text-amber-950 flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="font-bold">Plan is currently on Hold</p>
                <p className="mt-0.5 leading-relaxed">
                  Therapy room sessions and stage advancements are blocked until clinical resumption is approved.
                  Existing completed stages and prior approvals remain permanently intact in the legal audit log.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* 3-Stage Ordered Panchakarma Pipeline */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif font-bold text-[#143826] flex items-center gap-2">
              <span>🌿</span> Ordered Panchakarma Stage Pipeline
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Stages must be approved in strict chronological sequence
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {stages.map((stage) => {
              const isCurrent = stage.status === "current";
              const isCompleted = stage.status === "completed";
              const isFuture = stage.status === "future";

              return (
                <div
                  key={stage.ordinal}
                  className={`rounded-2xl border p-5 flex flex-col justify-between transition-all duration-300 ${
                    isCurrent
                      ? "bg-white border-emerald-600 ring-2 ring-emerald-600/20 shadow-md"
                      : isCompleted
                      ? "bg-emerald-900/5 border-emerald-900/20 shadow-xs"
                      : "bg-slate-50/70 border-slate-200/80 opacity-80"
                  }`}
                >
                  <div>
                    {/* Stage Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Stage {stage.ordinal}
                      </span>
                      {isCompleted && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          ✓ Completed
                        </span>
                      )}
                      {isCurrent && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#143826] text-white shadow-xs">
                          ● Current Stage
                        </span>
                      )}
                      {isFuture && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-700">
                          🔒 Locked (Future)
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-serif font-bold text-[#143826]">
                      {stage.name}
                    </h3>
                    <p className="text-xs font-semibold text-emerald-900 mt-0.5">
                      {stage.sanskritName}
                    </p>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      {stage.description}
                    </p>

                    {/* Prescribed Therapies */}
                    <div className="mt-4 pt-4 border-t border-slate-200/80">
                      <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Assigned Procedures
                      </p>
                      <ul className="space-y-2">
                        {stage.therapies.map((th, i) => (
                          <li
                            key={i}
                            className="text-xs p-2.5 rounded-lg bg-white border border-slate-200/70 flex justify-between items-center"
                          >
                            <span className="font-semibold text-slate-800">{th.name}</span>
                            <span className="text-[11px] text-emerald-900 font-mono">
                              {th.duration}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Stage Checklist */}
                    <div className="mt-4 pt-4 border-t border-slate-200/80">
                      <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Clinical Clearance Checklist
                      </p>
                      <div className="space-y-2">
                        {stage.checklist.map((item) => (
                          <label
                            key={item.id}
                            className={`flex items-start gap-2.5 text-xs p-2 rounded-lg cursor-pointer transition ${
                              item.checked ? "bg-emerald-50/60 text-emerald-950 font-medium" : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              disabled={isFuture || planStatus === "held"}
                              onChange={() => toggleChecklist(stage.ordinal, item.id)}
                              className="mt-0.5 rounded text-[#143826] focus:ring-[#143826]"
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Stage Footer Sign-off Info */}
                  <div className="mt-6 pt-3 border-t border-slate-200/70 text-[11px] text-slate-500">
                    {stage.approvedBy && (
                      <p>
                        Approved by <strong>{stage.approvedBy}</strong>
                      </p>
                    )}
                    {stage.completedAt && (
                      <p className="text-emerald-900 font-medium">
                        Completed: {new Date(stage.completedAt).toLocaleDateString("en-LK")}
                      </p>
                    )}
                    {isFuture && (
                      <p className="italic">
                        Requires successful completion of Stage {stage.ordinal - 1}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Clinical Decision Ledger & Audit Log */}
        <section className="bg-white rounded-2xl border border-[#2d513e]/15 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-serif font-bold text-[#143826]">
                Immutable Decision & Audit Ledger
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Every stage approval, advancement, hold, and cancellation is permanently recorded.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-900 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Audit Verified
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-semibold">
                  <th className="py-3 px-4">Timestamp (Asia/Colombo)</th>
                  <th className="py-3 px-4">Decision / Action</th>
                  <th className="py-3 px-4">Clinician</th>
                  <th className="py-3 px-4">Clinical Rationale & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {decisionHistory.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-600">{log.timestamp}</td>
                    <td className="py-3.5 px-4 font-bold text-[#143826]">{log.decision}</td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <strong>{log.actor}</strong>
                      <span className="block text-[11px] text-slate-500">{log.role}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 leading-relaxed">{log.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Modal: Put Plan on Hold */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-green-900/20 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-serif font-bold text-amber-900">
                ⏸ Place Care Plan on Clinical Hold
              </h3>
              <button
                type="button"
                onClick={() => setShowHoldModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePutOnHold} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Clinical Reason for Hold (Required)
                </label>
                <textarea
                  required
                  rows={3}
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="e.g. Acute fever spike, elevated systolic blood pressure, patient fatigue..."
                  className="w-full text-xs rounded-xl border border-slate-300 p-3 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-600 leading-relaxed"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-[11px] text-amber-900">
                <strong>Safety Notice:</strong> Putting this plan on hold will block scheduled room start clearance.
                Already completed stages remain intact in the permanent ledger.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHoldModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!holdReason.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 shadow-sm transition disabled:opacity-50"
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
          <div className="bg-white rounded-2xl border border-green-900/20 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-serif font-bold text-red-900">
                ✕ Cancel Care Plan
              </h3>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCancelPlan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Cancellation
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Patient discharge against medical advice, transfer to secondary care..."
                  className="w-full text-xs rounded-xl border border-slate-300 p-3 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-600 leading-relaxed"
                />
              </div>

              <div className="p-3 bg-red-50 rounded-xl border border-red-200/60 text-[11px] text-red-900">
                <strong>Irreversible Action:</strong> Cancellation cannot be reversed by UI control.
                Unstarted sessions will be cancelled.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!cancelReason.trim()}
                  className="px-5 py-2 rounded-xl bg-red-700 text-white text-xs font-bold hover:bg-red-800 shadow-sm transition disabled:opacity-50"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
