"use client";

import { useState } from "react";
import Link from "next/link";

interface Addendum {
  id: string;
  createdAt: string;
  authorName: string;
  authorRole: string;
  reason: string;
  content: string;
}

interface ConsultationRecord {
  id: string;
  consultationNumber: string;
  status: "signed" | "draft";
  signedAt?: string;
  signedBy?: string;
  practitionerTitle?: string;
  regNumber?: string;
  patient: {
    id: string;
    code: string;
    displayName: string;
    age: number;
    gender: string;
    prakriti: string;
    phone: string;
    registeredAt: string;
  };
  vitals: {
    bloodPressure: string;
    pulseRate: string;
    respiratoryRate: string;
    weightKg: string;
    temperature: string;
    agniStatus: string;
  };
  doshaEvaluation: {
    vata: number;
    pitta: number;
    kapha: number;
    notes: string;
  };
  ashtavidhaPariksha: {
    nadi: string;
    jihva: string;
    sparsha: string;
    shabda: string;
    druk: string;
    akruti: string;
    mutra: string;
    mala: string;
  };
  symptoms: {
    chiefComplaints: string;
    duration: string;
    associatedFactors: string;
    historyOfPresentIllness: string;
  };
  diagnosis: {
    classicalDiagnosis: string;
    sampraptiGhataka: string;
    prognosis: string;
  };
  prescriptions: Array<{
    item: string;
    dosage: string;
    frequency: string;
    timing: string;
    duration: string;
  }>;
  recommendedTherapies: Array<{
    therapy: string;
    targetDays: number;
    notes: string;
  }>;
  signedNoteBody: string;
  addenda: Addendum[];
}

const defaultRecord: ConsultationRecord = {
  id: "con-col-2026-00402",
  consultationNumber: "CLN-AYUR-2026-0894",
  status: "signed",
  signedAt: "2026-10-24T11:30:00+05:30",
  signedBy: "Dr. Ananya Sharma",
  practitionerTitle: "BAMS (Hons), MD (Ayur) · Senior Ayurvedic Physician",
  regNumber: "SLAMC-REG-8924",
  patient: {
    id: "00000000-0000-4000-8000-000000000101",
    code: "AYUR-2026-0042",
    displayName: "Saman Kumara Jayawardena",
    age: 48,
    gender: "Male",
    prakriti: "Vata-Pitta Prakriti",
    phone: "+94 77 123 4567",
    registeredAt: "12 Oct 2026",
  },
  vitals: {
    bloodPressure: "124/82 mmHg",
    pulseRate: "74 bpm (Nadi rhythm: Sarpa-gati)",
    respiratoryRate: "16 breaths/min",
    weightKg: "72.4 kg",
    temperature: "98.4 °F",
    agniStatus: "Mandaagni (Impaired digestive fire with Ama)",
  },
  doshaEvaluation: {
    vata: 82,
    pitta: 54,
    kapha: 28,
    notes: "Marked Vata dusthi manifesting in Asthi and Sandhi dhatus with secondary Pitta anubandha (mild inflammation).",
  },
  ashtavidhaPariksha: {
    nadi: "Sarpa-gati predominant, irregular rhythm indicative of Vata elevation.",
    jihva: "Sama Jihva (whitish coating at base reflecting mild ama residue).",
    sparsha: "Ruksha (dryness over joint peripheries), local ushnatva absent.",
    shabda: "Prakruta (clear, resonant tone).",
    druk: "Spashta (clear sclera, slight dryness around palpebrae).",
    akruti: "Madhyama (medium build with muscular tightness in hamstring).",
    mutra: "Prakruta (pale yellow, normal frequency).",
    mala: "Baddha-mala (mild constipation, dry evacuation).",
  },
  symptoms: {
    chiefComplaints: "Severe stiffness and bilateral knee pain aggravated during early morning and after cold exposure. Crepitus observed on flexion.",
    duration: "6 months with worsening over past 3 weeks.",
    associatedFactors: "Aggravated by cold damp weather, prolonged standing; relieved mildly by warm compress.",
    historyOfPresentIllness: "Patient reports sedentary lifestyle with irregular meal times. Initial joint ache began after long-distance driving.",
  },
  diagnosis: {
    classicalDiagnosis: "Sandhigata Vata (Osteoarthritis with Vata vridhi)",
    sampraptiGhataka: "Dosha: Vyana Vata, Shleshaka Kapha; Dushya: Asthi, Sandhi; Srotas: Asthivaha, Purishavaha.",
    prognosis: "Krichra Sadhya (Manageable with comprehensive Shodhana and Sthanika therapies).",
  },
  prescriptions: [
    { item: "Maharasnadi Kwatha", dosage: "30 ml", frequency: "Twice daily", timing: "Before meals with 60ml lukewarm water", duration: "14 days" },
    { item: "Yogaraja Guggulu", dosage: "2 tablets", frequency: "Twice daily", timing: "After meals with warm water", duration: "21 days" },
    { item: "Kottamchukkadi Taila", dosage: "Adequate quantity", frequency: "Once daily", timing: "External local application with warm fomentation", duration: "14 days" },
    { item: "Haritaki Churna", dosage: "3 g", frequency: "Nightly", timing: "At bedtime with warm water for Anulomana", duration: "7 days" },
  ],
  recommendedTherapies: [
    { therapy: "Janu Basti with Dhanwantaram Taila", targetDays: 7, notes: "Retain warm medicated oil over both knees for 30 minutes daily." },
    { therapy: "Patra Pinda Sweda (Elakizhi)", targetDays: 5, notes: "Herbal bolus steam application following Snehana." },
    { therapy: "Sarvanga Abhyanga & Bashpa Sweda", targetDays: 3, notes: "Full body oleation to calm systemic Vata." },
  ],
  signedNoteBody: "The patient demonstrates classic Sandhigata Vata symptoms with Asthi-Majja dhatu involvement. Snehana and Swedana protocol indicated prior to considering Matra Vasti. Dietary regimen must avoid dry, pungent, and refrigerated foods. Re-evaluation scheduled after 14 days of protocol.",
  addenda: [
    {
      id: "add-01",
      createdAt: "2026-10-25T09:15:00+05:30",
      authorName: "Dr. Ananya Sharma",
      authorRole: "Consultant Physician",
      reason: "Clarification on external application",
      content: "Patient phoned regarding skin sensitivity to warm oils. Instructed to apply Kottamchukkadi Taila at lukewarm temperature rather than hot. No erythema or adverse reaction noted.",
    },
  ],
};

export function SignedConsultationView() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [record, setRecord] = useState<ConsultationRecord>(defaultRecord);
  const [activeTab, setActiveTab] = useState<"clinical" | "pariksha" | "chikitsa" | "addenda">("clinical");
  const [showAddendumModal, setShowAddendumModal] = useState(false);
  const [addendumReason, setAddendumReason] = useState("Observation");
  const [addendumBody, setAddendumBody] = useState("");
  const [isSubmittingAddendum, setIsSubmittingAddendum] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddAddendum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addendumBody.trim()) return;

    setIsSubmittingAddendum(true);
    setTimeout(() => {
      const newAddendum: Addendum = {
        id: `add-${Date.now()}`,
        createdAt: new Date().toISOString(),
        authorName: "Dr. Ananya Sharma",
        authorRole: "Attending Clinician",
        reason: addendumReason,
        content: addendumBody.trim(),
      };
      setRecord((prev) => ({
        ...prev,
        addenda: [newAddendum, ...prev.addenda],
      }));
      setAddendumBody("");
      setShowAddendumModal(false);
      setIsSubmittingAddendum(false);
      triggerToast("Dated clinical addendum recorded and signed.");
    }, 400);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f6efe4] text-[#1c2820] font-sans antialiased selection:bg-[#d9e6d8] selection:text-[#143826]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#143826] text-white px-5 py-3.5 rounded-xl shadow-xl border border-emerald-500/30 text-sm font-medium animate-fade-in">
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
          {/* Brand header */}
          <div className="flex items-center justify-between">
            <Link href="/reception" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 28 28"
                  fill="none"
                  stroke="#d7b98d"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 19C10 22 18 22 22 19" />
                  <path d="M14 19V11" />
                  <path d="M14 14C11 11 9 9 9 6C12 6 14 8 14 11Z" />
                  <path d="M14 12C16 9 18 7 21 7C21 10 19 12 14 13Z" />
                </svg>
              </div>
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

          {/* Subtitle with botanical leaf divider */}
          <div className="mt-2.5">
            <p className="text-[10px] font-semibold tracking-[0.22em] text-[#799a84] uppercase">
              Staff Workspace
            </p>
            <div className="flex items-center gap-2 w-full my-3">
              <div className="h-px bg-[#234d38] flex-1" />
              <svg width="18" height="12" viewBox="0 0 24 14" fill="none" stroke="#5a866b" strokeWidth="1.5">
                <path d="M2 7C8 2 16 2 22 7C16 12 8 12 2 7Z" />
                <path d="M2 7C9 7 15 6 22 7" />
              </svg>
              <div className="h-px bg-[#234d38] flex-1" />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-5 space-y-1.5" aria-label="Consultations Navigation">
            <Link
              href="/reception"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
            >
              <span>Overview</span>
            </Link>

            <Link
              href="/patients"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
            >
              <span>Patients</span>
            </Link>

            <Link
              href="/scheduling"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
            >
              <span>Schedule</span>
            </Link>

            {/* Consultations (ACTIVE) */}
            <Link
              href="/clinical"
              className="flex items-center px-4 py-2.5 rounded-xl bg-[#f3efe6] text-[#143826] font-semibold text-sm shadow-xs transition-colors"
            >
              <span>Consultations</span>
            </Link>

            <Link
              href="/clinical/plans"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
            >
              <span>Care Plans</span>
            </Link>

            <Link
              href="/billing"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
            >
              <span>Billing & Invoices</span>
            </Link>

            <Link
              href="/dashboard"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
            >
              <span>Clinic Dashboard</span>
            </Link>
          </nav>

          {/* Botanical Herbal Plant Drawing in Left Sidebar */}
          <div className="mt-8 px-4 opacity-30 flex justify-center pointer-events-none select-none">
            <svg width="140" height="110" viewBox="0 0 140 110" fill="none" stroke="#d7b98d" strokeWidth="1.2">
              <path d="M70 105 V40" />
              <path d="M70 75 C60 65 45 65 35 70 C40 60 55 58 70 70" />
              <path d="M70 60 C80 50 95 50 105 55 C100 45 85 43 70 55" />
              <path d="M70 45 C55 35 48 20 52 10 C62 18 66 32 70 40" />
              <path d="M70 45 C85 35 92 20 88 10 C78 18 74 32 70 40" />
              <circle cx="70" cy="10" r="2.5" fill="#d7b98d" />
            </svg>
          </div>
        </div>

        {/* User profile & clinic branch in sidebar */}
        <div className="pt-4 border-t border-[#234d38] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1e5237] border border-[#3b7352] flex items-center justify-center text-xs font-serif text-amber-100">
              MS
            </div>
            <div>
              <p className="text-xs font-medium text-[#e1ece4]">Dr. Maya S.</p>
              <p className="text-[10px] text-[#799a84]">Colombo Clinic</p>
            </div>
          </div>
          <Link
            href="/sign-in"
            className="text-xs text-[#9ab7a4] hover:text-white"
            title="Sign out of staff workspace"
          >
            Exit
          </Link>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MAIN CONTENT AREA - Living Heritage Parchment Canvas */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="px-6 lg:px-10 py-5 flex items-center justify-between border-b border-[#e2d7c5] bg-[#fbf8f2]/90 backdrop-blur-xs sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden text-[#143826] p-1.5 rounded-lg hover:bg-[#ebdcc8]"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span className="text-[11px] font-semibold tracking-wider text-[#637d6e] uppercase">
                  Living Heritage · Clinical Encounter
                </span>
              </div>
              <h1 className="text-xl lg:text-2xl font-serif font-bold text-[#143826] tracking-tight">
                Signed Consultation Record
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/clinical/plans"
              className="px-4 py-2 rounded-xl bg-white text-[#143826] border border-[#d8cbbb] hover:bg-[#eae3d5] text-xs font-bold shadow-xs transition"
            >
              Care Plans & Stages →
            </Link>
            <button
              type="button"
              onClick={() => setShowAddendumModal(true)}
              className="px-4 py-2 rounded-xl bg-[#143826] text-white hover:bg-[#1a4732] text-xs font-bold shadow-sm transition flex items-center gap-2"
            >
              <span>+</span>
              <span>Add Dated Addendum</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-6 lg:p-10 space-y-8 max-w-7xl w-full mx-auto">
          {/* Patient Identity & Signed Consultation Banner */}
          <section className="bg-[#fbf8f2] rounded-2xl border border-[#e2d7c5] shadow-xs p-6 relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#143826] text-white flex items-center gap-1.5 shadow-xs">
                    <span>✓</span>
                    <span>Signed & Immutable Record</span>
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
                    {record.patient.prakriti}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Consultation: {record.consultationNumber}
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#143826] tracking-tight">
                  {record.patient.displayName}
                </h2>

                <div className="flex flex-wrap items-center gap-y-1 gap-x-5 mt-2 text-xs text-[#526558]">
                  <span>
                    <strong>Patient Code:</strong> {record.patient.code}
                  </span>
                  <span>
                    <strong>Demographics:</strong> {record.patient.age} yrs · {record.patient.gender}
                  </span>
                  <span>
                    <strong>Contact:</strong> {record.patient.phone}
                  </span>
                  <span>
                    <strong>Registered:</strong> {record.patient.registeredAt}
                  </span>
                </div>
              </div>

              {/* Practitioner Signature Seal Block */}
              <div className="bg-white border border-[#d8cbbb] rounded-xl p-4 min-w-[280px] shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#143826] text-amber-200 flex items-center justify-center font-serif text-lg font-bold shrink-0 shadow-inner">
                    ⚕
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                      Official Digital Seal
                    </p>
                    <p className="text-sm font-serif font-bold text-[#143826]">
                      {record.signedBy}
                    </p>
                    <p className="text-[11px] text-[#6b7d72]">{record.practitionerTitle}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Reg: <strong className="text-slate-700">{record.regNumber}</strong> · Signed:{" "}
                      <span className="text-emerald-900 font-semibold">24 Oct 2026, 11:30 AM (Colombo)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-[#e2d7c5] overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("clinical")}
              className={`px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition ${
                activeTab === "clinical"
                  ? "bg-[#143826] text-white shadow-xs font-semibold"
                  : "text-[#526558] hover:text-[#143826] hover:bg-[#ede5d8]"
              }`}
            >
              📋 Clinical Examination & Vitals
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pariksha")}
              className={`px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition ${
                activeTab === "pariksha"
                  ? "bg-[#143826] text-white shadow-xs font-semibold"
                  : "text-[#526558] hover:text-[#143826] hover:bg-[#ede5d8]"
              }`}
            >
              🔍 Ashtavidha Pariksha (Classical 8-Fold)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("chikitsa")}
              className={`px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition ${
                activeTab === "chikitsa"
                  ? "bg-[#143826] text-white shadow-xs font-semibold"
                  : "text-[#526558] hover:text-[#143826] hover:bg-[#ede5d8]"
              }`}
            >
              🌿 Chikitsa & Prescriptions ({record.prescriptions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("addenda")}
              className={`px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition ${
                activeTab === "addenda"
                  ? "bg-[#143826] text-white shadow-xs font-semibold"
                  : "text-[#526558] hover:text-[#143826] hover:bg-[#ede5d8]"
              }`}
            >
              📑 Dated Addenda ({record.addenda.length})
            </button>
          </div>

          {/* TAB 1: Clinical Examination & Vitals */}
          {activeTab === "clinical" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Vitals Grid */}
                <div className="bg-[#fbf8f2] rounded-2xl border border-[#e2d7c5] p-5 shadow-xs">
                  <h3 className="text-sm font-serif font-bold text-[#143826] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span>🩺</span> Vital Signs & Agni Status
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded-xl border border-[#e2d7c5]">
                      <p className="text-[11px] text-[#6b7d72] font-medium">Blood Pressure</p>
                      <p className="text-base font-bold text-[#143826]">{record.vitals.bloodPressure}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#e2d7c5]">
                      <p className="text-[11px] text-[#6b7d72] font-medium">Pulse Rate & Nadi</p>
                      <p className="text-base font-bold text-[#143826]">{record.vitals.pulseRate}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#e2d7c5]">
                      <p className="text-[11px] text-[#6b7d72] font-medium">Body Weight</p>
                      <p className="text-base font-bold text-[#143826]">{record.vitals.weightKg}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#e2d7c5]">
                      <p className="text-[11px] text-[#6b7d72] font-medium">Temperature</p>
                      <p className="text-base font-bold text-[#143826]">{record.vitals.temperature}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#e2d7c5] sm:col-span-2">
                      <p className="text-[11px] text-[#6b7d72] font-medium">Agni (Digestive Capacity)</p>
                      <p className="text-sm font-semibold text-emerald-900">{record.vitals.agniStatus}</p>
                    </div>
                  </div>
                </div>

                {/* Symptoms & Subjective History */}
                <div className="bg-[#fbf8f2] rounded-2xl border border-[#e2d7c5] p-5 shadow-xs space-y-4">
                  <h3 className="text-sm font-serif font-bold text-[#143826] uppercase tracking-wider flex items-center gap-2">
                    <span>📝</span> Subjective Examination & Lakshana
                  </h3>
                  <div>
                    <h4 className="text-xs font-bold text-[#143826]">Chief Complaints</h4>
                    <p className="text-sm text-slate-800 bg-[#f5ede0] p-3 rounded-xl border border-[#e2d7c5] mt-1">
                      {record.symptoms.chiefComplaints}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-[#143826]">Duration & Onset</h4>
                      <p className="text-xs text-[#526558] mt-1">{record.symptoms.duration}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#143826]">Aggravating Factors</h4>
                      <p className="text-xs text-[#526558] mt-1">{record.symptoms.associatedFactors}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#143826]">History of Present Illness</h4>
                    <p className="text-xs text-[#526558] mt-1 leading-relaxed">
                      {record.symptoms.historyOfPresentIllness}
                    </p>
                  </div>
                </div>

                {/* Physician Signed Note Body */}
                <div className="bg-[#143826]/5 border border-[#143826]/20 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-serif font-bold text-[#143826] uppercase tracking-wider flex items-center gap-2">
                      <span>📜</span> Clinician Synthesis & Signed Record Note
                    </h3>
                    <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-semibold">
                      Locked Original
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed font-serif italic bg-white p-4 rounded-xl border border-[#e2d7c5]">
                    &ldquo;{record.signedNoteBody}&rdquo;
                  </p>
                </div>
              </div>

              {/* Right Col: Dosha Vaishamya Meter & Diagnosis */}
              <div className="space-y-6">
                {/* Dosha Balance Meter */}
                <div className="bg-[#fbf8f2] rounded-2xl border border-[#e2d7c5] p-5 shadow-xs">
                  <h3 className="text-sm font-serif font-bold text-[#143826] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span>⚖️</span> Dosha Vaishamya (Imbalance)
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-indigo-900">Vata Dosha (Aggravated)</span>
                        <span className="font-bold text-indigo-900">{record.doshaEvaluation.vata}%</span>
                      </div>
                      <div className="w-full h-3 bg-indigo-50 rounded-full overflow-hidden border border-indigo-200">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full transition-all duration-500"
                          style={{ width: `${record.doshaEvaluation.vata}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-amber-900">Pitta Dosha (Moderate)</span>
                        <span className="font-bold text-amber-900">{record.doshaEvaluation.pitta}%</span>
                      </div>
                      <div className="w-full h-3 bg-amber-50 rounded-full overflow-hidden border border-amber-200">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-700 rounded-full transition-all duration-500"
                          style={{ width: `${record.doshaEvaluation.pitta}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-emerald-900">Kapha Dosha (Balanced)</span>
                        <span className="font-bold text-emerald-900">{record.doshaEvaluation.kapha}%</span>
                      </div>
                      <div className="w-full h-3 bg-emerald-50 rounded-full overflow-hidden border border-emerald-200">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-full transition-all duration-500"
                          style={{ width: `${record.doshaEvaluation.kapha}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#526558] mt-4 p-3 bg-white rounded-xl border border-[#e2d7c5] leading-relaxed">
                    {record.doshaEvaluation.notes}
                  </p>
                </div>

                {/* Classical Diagnosis */}
                <div className="bg-[#fbf8f2] rounded-2xl border border-[#e2d7c5] p-5 shadow-xs">
                  <h3 className="text-sm font-serif font-bold text-[#143826] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>🌿</span> Roga Vinischaya (Diagnosis)
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] text-[#6b7d72] font-medium">Classical Diagnosis</p>
                      <p className="text-sm font-bold text-[#143826] font-serif">
                        {record.diagnosis.classicalDiagnosis}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#6b7d72] font-medium">Samprapti Ghataka</p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {record.diagnosis.sampraptiGhataka}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#6b7d72] font-medium">Sadhya / Asadhyata (Prognosis)</p>
                      <p className="text-xs font-semibold text-emerald-900 bg-emerald-50 p-2 rounded-lg border border-emerald-200/60 inline-block mt-1">
                        {record.diagnosis.prognosis}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Ashtavidha Pariksha */}
          {activeTab === "pariksha" && (
            <div className="bg-[#fbf8f2] rounded-2xl border border-[#e2d7c5] p-6 shadow-xs">
              <div className="mb-6">
                <h3 className="text-lg font-serif font-bold text-[#143826]">
                  Ashtavidha Pariksha (Classical Ayurvedic 8-Fold Examination)
                </h3>
                <p className="text-xs text-[#6b7d72] mt-1">
                  Standardized diagnostic assessment according to classical Caraka and Susruta Samhitas.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-[#e2d7c5] bg-white">
                  <div className="flex items-center gap-2 text-[#143826] font-bold text-sm mb-1">
                    <span>1.</span>
                    <span>Nadi (Pulse Examination)</span>
                  </div>
                  <p className="text-xs text-[#526558] leading-relaxed">{record.ashtavidhaPariksha.nadi}</p>
                </div>

                <div className="p-4 rounded-xl border border-[#e2d7c5] bg-white">
                  <div className="flex items-center gap-2 text-[#143826] font-bold text-sm mb-1">
                    <span>2.</span>
                    <span>Jihva (Tongue Examination)</span>
                  </div>
                  <p className="text-xs text-[#526558] leading-relaxed">{record.ashtavidhaPariksha.jihva}</p>
                </div>

                <div className="p-4 rounded-xl border border-[#e2d7c5] bg-white">
                  <div className="flex items-center gap-2 text-[#143826] font-bold text-sm mb-1">
                    <span>3.</span>
                    <span>Sparsha (Tactile / Skin Assessment)</span>
                  </div>
                  <p className="text-xs text-[#526558] leading-relaxed">{record.ashtavidhaPariksha.sparsha}</p>
                </div>

                <div className="p-4 rounded-xl border border-[#e2d7c5] bg-white">
                  <div className="flex items-center gap-2 text-[#143826] font-bold text-sm mb-1">
                    <span>4.</span>
                    <span>Shabda (Voice & Respiratory Sound)</span>
                  </div>
                  <p className="text-xs text-[#526558] leading-relaxed">{record.ashtavidhaPariksha.shabda}</p>
                </div>

                <div className="p-4 rounded-xl border border-[#e2d7c5] bg-white">
                  <div className="flex items-center gap-2 text-[#143826] font-bold text-sm mb-1">
                    <span>5.</span>
                    <span>Druk (Eye & Visual Examination)</span>
                  </div>
                  <p className="text-xs text-[#526558] leading-relaxed">{record.ashtavidhaPariksha.druk}</p>
                </div>

                <div className="p-4 rounded-xl border border-[#e2d7c5] bg-white">
                  <div className="flex items-center gap-2 text-[#143826] font-bold text-sm mb-1">
                    <span>6.</span>
                    <span>Akruti (Physical Constitution / Gait)</span>
                  </div>
                  <p className="text-xs text-[#526558] leading-relaxed">{record.ashtavidhaPariksha.akruti}</p>
                </div>

                <div className="p-4 rounded-xl border border-[#e2d7c5] bg-white">
                  <div className="flex items-center gap-2 text-[#143826] font-bold text-sm mb-1">
                    <span>7.</span>
                    <span>Mutra (Urine Examination)</span>
                  </div>
                  <p className="text-xs text-[#526558] leading-relaxed">{record.ashtavidhaPariksha.mutra}</p>
                </div>

                <div className="p-4 rounded-xl border border-[#e2d7c5] bg-white">
                  <div className="flex items-center gap-2 text-[#143826] font-bold text-sm mb-1">
                    <span>8.</span>
                    <span>Mala (Fecal / Bowel Assessment)</span>
                  </div>
                  <p className="text-xs text-[#526558] leading-relaxed">{record.ashtavidhaPariksha.mala}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Chikitsa & Prescriptions */}
          {activeTab === "chikitsa" && (
            <div className="space-y-6">
              <div className="bg-[#fbf8f2] rounded-2xl border border-[#e2d7c5] p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-serif font-bold text-[#143826]">
                      Prescribed Classical Ayurvedic Formulations
                    </h3>
                    <p className="text-xs text-[#6b7d72] mt-0.5">
                      Dispensed by Colombo Clinic Ayurvedic Dispensary with traceability.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-900 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    Signed Prescriptions
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#e2d7c5] bg-[#f0ebd9] text-[#143826] font-semibold">
                        <th className="py-3 px-4">Medicine / Formulation</th>
                        <th className="py-3 px-3">Dosage</th>
                        <th className="py-3 px-3">Frequency</th>
                        <th className="py-3 px-4">Timing & Anupana</th>
                        <th className="py-3 px-3 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ede5d8]">
                      {record.prescriptions.map((rx, idx) => (
                        <tr key={idx} className="hover:bg-white/60 transition">
                          <td className="py-3.5 px-4 font-bold text-[#143826] font-serif text-sm">
                            {rx.item}
                          </td>
                          <td className="py-3.5 px-3 text-[#526558] font-medium">{rx.dosage}</td>
                          <td className="py-3.5 px-3 text-[#526558]">{rx.frequency}</td>
                          <td className="py-3.5 px-4 text-[#526558]">{rx.timing}</td>
                          <td className="py-3.5 px-3 text-right font-semibold text-emerald-900">
                            {rx.duration}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recommended Therapies */}
              <div className="bg-[#fbf8f2] rounded-2xl border border-[#e2d7c5] p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-serif font-bold text-[#143826]">
                      Recommended Clinical Therapies for Care Plan
                    </h3>
                    <p className="text-xs text-[#6b7d72] mt-0.5">
                      Transferred to Care Plan Pathway upon stage approval.
                    </p>
                  </div>
                  <Link
                    href="/clinical/plans"
                    className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline"
                  >
                    View in Care Plan Workspace →
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {record.recommendedTherapies.map((th, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-[#e2d7c5] bg-white shadow-2xs"
                    >
                      <p className="text-xs font-bold text-[#143826] font-serif">{th.therapy}</p>
                      <p className="text-xs text-emerald-900 font-semibold mt-1">
                        Course: {th.targetDays} Consecutive Days
                      </p>
                      <p className="text-[11px] text-[#6b7d72] mt-2 leading-relaxed">{th.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Dated Addenda */}
          {activeTab === "addenda" && (
            <div className="bg-[#fbf8f2] rounded-2xl border border-[#e2d7c5] p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-serif font-bold text-[#143826]">
                    Signed Consultation Addendum Ledger
                  </h3>
                  <p className="text-xs text-[#6b7d72] mt-1">
                    In compliance with clinical legal standards, signed original notes cannot be modified.
                    Dated corrections and post-consultation observations are recorded here as immutable addenda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddendumModal(true)}
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-[#143826] text-white hover:bg-[#1a4732] shadow-sm transition"
                >
                  + Add Dated Addendum
                </button>
              </div>

              {record.addenda.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-[#e2d7c5]">
                  <p className="text-sm text-slate-500">No addenda recorded for this consultation.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {record.addenda.map((add) => (
                    <div
                      key={add.id}
                      className="border-l-4 border-emerald-700 bg-white p-4 rounded-r-xl border border-[#e2d7c5] shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#143826] font-serif">{add.authorName}</span>
                          <span className="text-[#6b7d72]">({add.authorRole})</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100/70 text-emerald-900 font-semibold text-[10px]">
                            Reason: {add.reason}
                          </span>
                        </div>
                        <span className="text-[#6b7d72] font-mono text-[11px]">
                          {new Date(add.createdAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed font-sans">{add.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modal: Add Dated Addendum */}
      {showAddendumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#fbf8f2] rounded-2xl border border-[#d8cbbb] max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e2d7c5] pb-3">
              <div>
                <h3 className="text-base font-serif font-bold text-[#143826]">
                  Record Dated Addendum
                </h3>
                <p className="text-xs text-[#6b7d72] mt-0.5">
                  Append an immutable post-signature observation or clarification.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddendumModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAddendum} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#143826] mb-1">
                  Clinical Reason
                </label>
                <select
                  value={addendumReason}
                  onChange={(e) => setAddendumReason(e.target.value)}
                  className="w-full text-xs rounded-xl border border-[#d8cbbb] p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                >
                  <option value="Clarification">Clarification of prescribed regimen</option>
                  <option value="Laboratory Result">Laboratory / Diagnostic investigation update</option>
                  <option value="Patient Tolerance Review">Patient tolerance or symptom progression</option>
                  <option value="Dietary Guidance">Supplementary dietary & lifestyle instruction</option>
                  <option value="Correction of Clerical Error">Correction of typographical entry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#143826] mb-1">
                  Addendum Statement
                </label>
                <textarea
                  required
                  rows={4}
                  value={addendumBody}
                  onChange={(e) => setAddendumBody(e.target.value)}
                  placeholder="Enter explicit clinical observation or addendum detail..."
                  className="w-full text-xs rounded-xl border border-[#d8cbbb] p-3 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826] leading-relaxed"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-[11px] text-amber-900">
                <strong>Legal Record Notice:</strong> This entry will be permanently timestamped under your
                practitioner credentials in Asia/Colombo timezone and linked to consultation #{record.consultationNumber}.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddendumModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#d8cbbb] text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAddendum || !addendumBody.trim()}
                  className="px-5 py-2 rounded-xl bg-[#143826] text-white text-xs font-bold hover:bg-[#1a4732] shadow-sm transition disabled:opacity-50"
                >
                  {isSubmittingAddendum ? "Signing Addendum..." : "Sign & Append Addendum"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
