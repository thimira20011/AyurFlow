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
    vata: number; // 0 to 100
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
    <div className="min-h-screen bg-[#f7f5ef] text-[#1c2e24] pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#143826] text-white px-5 py-3.5 rounded-xl shadow-xl border border-emerald-500/30 text-sm font-medium animate-fade-in">
          <span>🌿</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Living Heritage Breadcrumb & Actions Bar */}
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
              href="/patients"
              className="text-xs font-semibold text-slate-600 hover:text-emerald-900 transition"
            >
              Patient Registry
            </Link>
            <span className="text-[#96a79e] text-xs">/</span>
            <span className="text-xs font-bold text-[#143826] bg-emerald-100/70 px-2 py-0.5 rounded">
              Signed Consultation #{record.consultationNumber}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/clinical/plans"
              className="text-xs font-bold px-4 py-2 rounded-xl bg-white text-[#143826] border border-[#143826]/25 hover:bg-emerald-50 shadow-xs transition"
            >
              Care Plans & Stages →
            </Link>
            <button
              type="button"
              onClick={() => setShowAddendumModal(true)}
              className="text-xs font-bold px-4 py-2 rounded-xl bg-[#143826] text-white hover:bg-[#1a4732] shadow-sm transition flex items-center gap-2"
            >
              <span>+ Add Dated Addendum</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Patient Identity & Consultation Signed Banner */}
        <section className="bg-white rounded-2xl border border-[#2d513e]/15 shadow-sm p-6 relative overflow-hidden">
          {/* Subtle Botanical SVG Background Accent */}
          <div className="absolute right-4 -bottom-6 opacity-10 pointer-events-none select-none">
            <svg width="220" height="220" viewBox="0 0 100 100" fill="#143826">
              <path d="M50 0 C65 25 85 45 100 50 C85 55 65 75 50 100 C35 75 15 55 0 50 C15 45 35 25 50 0 Z" />
            </svg>
          </div>

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

              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#143826] tracking-tight">
                {record.patient.displayName}
              </h1>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-5 mt-2 text-xs text-slate-600">
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
            <div className="bg-[#fcfbf7] border border-[#2d513e]/20 rounded-xl p-4 min-w-[280px] shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-900 text-amber-200 flex items-center justify-center font-serif text-lg font-bold shrink-0 shadow-inner">
                  ⚕
                </div>
                <div>
                  <p className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                    Official Digital Seal
                  </p>
                  <p className="text-sm font-serif font-bold text-[#143826]">
                    {record.signedBy}
                  </p>
                  <p className="text-[11px] text-slate-600">{record.practitionerTitle}</p>
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
        <div className="flex items-center gap-2 border-b border-[#2d513e]/15 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("clinical")}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition ${
              activeTab === "clinical"
                ? "bg-[#143826] text-white shadow-xs font-semibold"
                : "text-slate-600 hover:text-emerald-950 hover:bg-emerald-50"
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
                : "text-slate-600 hover:text-emerald-950 hover:bg-emerald-50"
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
                : "text-slate-600 hover:text-emerald-950 hover:bg-emerald-50"
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
                : "text-slate-600 hover:text-emerald-950 hover:bg-emerald-50"
            }`}
          >
            📑 Dated Addenda ({record.addenda.length})
          </button>
        </div>

        {/* TAB 1: Clinical Examination & Vitals */}
        {activeTab === "clinical" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Subjective, Vitals, Diagnosis */}
            <div className="lg:col-span-2 space-y-6">
              {/* Vitals Grid */}
              <div className="bg-white rounded-2xl border border-[#2d513e]/15 p-5 shadow-xs">
                <h2 className="text-sm font-serif font-bold text-[#143826] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span>🩺</span> Vital Signs & Agni Status
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="bg-[#fcfbf7] p-3 rounded-xl border border-slate-200/80">
                    <p className="text-[11px] text-slate-500 font-medium">Blood Pressure</p>
                    <p className="text-base font-bold text-[#143826]">{record.vitals.bloodPressure}</p>
                  </div>
                  <div className="bg-[#fcfbf7] p-3 rounded-xl border border-slate-200/80">
                    <p className="text-[11px] text-slate-500 font-medium">Pulse Rate & Nadi</p>
                    <p className="text-base font-bold text-[#143826]">{record.vitals.pulseRate}</p>
                  </div>
                  <div className="bg-[#fcfbf7] p-3 rounded-xl border border-slate-200/80">
                    <p className="text-[11px] text-slate-500 font-medium">Body Weight</p>
                    <p className="text-base font-bold text-[#143826]">{record.vitals.weightKg}</p>
                  </div>
                  <div className="bg-[#fcfbf7] p-3 rounded-xl border border-slate-200/80">
                    <p className="text-[11px] text-slate-500 font-medium">Temperature</p>
                    <p className="text-base font-bold text-[#143826]">{record.vitals.temperature}</p>
                  </div>
                  <div className="bg-[#fcfbf7] p-3 rounded-xl border border-slate-200/80 sm:col-span-2">
                    <p className="text-[11px] text-slate-500 font-medium">Agni (Digestive Capacity)</p>
                    <p className="text-sm font-semibold text-emerald-900">{record.vitals.agniStatus}</p>
                  </div>
                </div>
              </div>

              {/* Symptoms & Subjective History */}
              <div className="bg-white rounded-2xl border border-[#2d513e]/15 p-5 shadow-xs space-y-4">
                <h2 className="text-sm font-serif font-bold text-[#143826] uppercase tracking-wider flex items-center gap-2">
                  <span>📝</span> Subjective Examination & Lakshana
                </h2>
                <div>
                  <h3 className="text-xs font-bold text-slate-700">Chief Complaints</h3>
                  <p className="text-sm text-slate-800 bg-amber-50/50 p-3 rounded-xl border border-amber-200/50 mt-1">
                    {record.symptoms.chiefComplaints}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-700">Duration & Onset</h3>
                    <p className="text-xs text-slate-600 mt-1">{record.symptoms.duration}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-700">Aggravating Factors</h3>
                    <p className="text-xs text-slate-600 mt-1">{record.symptoms.associatedFactors}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-700">History of Present Illness</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {record.symptoms.historyOfPresentIllness}
                  </p>
                </div>
              </div>

              {/* Physician Signed Note Body */}
              <div className="bg-emerald-900/5 border border-emerald-900/20 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-serif font-bold text-[#143826] uppercase tracking-wider flex items-center gap-2">
                    <span>📜</span> Clinician Synthesis & Signed Record Note
                  </h2>
                  <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-semibold">
                    Locked Original
                  </span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed font-serif italic bg-white p-4 rounded-xl border border-emerald-900/10">
                  &ldquo;{record.signedNoteBody}&rdquo;
                </p>
              </div>
            </div>

            {/* Right Col: Dosha Vaishamya Meter & Diagnosis */}
            <div className="space-y-6">
              {/* Dosha Balance Meter */}
              <div className="bg-white rounded-2xl border border-[#2d513e]/15 p-5 shadow-xs">
                <h2 className="text-sm font-serif font-bold text-[#143826] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span>⚖️</span> Dosha Vaishamya (Imbalance)
                </h2>

                <div className="space-y-4">
                  {/* Vata Bar */}
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

                  {/* Pitta Bar */}
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

                  {/* Kapha Bar */}
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

                <p className="text-xs text-slate-600 mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200/70 leading-relaxed">
                  {record.doshaEvaluation.notes}
                </p>
              </div>

              {/* Classical Diagnosis (Roga Nidana) */}
              <div className="bg-white rounded-2xl border border-[#2d513e]/15 p-5 shadow-xs">
                <h2 className="text-sm font-serif font-bold text-[#143826] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>🌿</span> Roga Vinischaya (Diagnosis)
                </h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">Classical Diagnosis</p>
                    <p className="text-sm font-bold text-[#143826] font-serif">
                      {record.diagnosis.classicalDiagnosis}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">Samprapti Ghataka</p>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {record.diagnosis.sampraptiGhataka}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">Sadhya / Asadhyata (Prognosis)</p>
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
          <div className="bg-white rounded-2xl border border-[#2d513e]/15 p-6 shadow-xs">
            <div className="mb-6">
              <h2 className="text-lg font-serif font-bold text-[#143826]">
                Ashtavidha Pariksha (Classical Ayurvedic 8-Fold Examination)
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Standardized diagnostic assessment according to classical Caraka and Susruta Samhitas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-emerald-900/10 bg-[#fcfbf7]">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-1">
                  <span>1.</span>
                  <span>Nadi (Pulse Examination)</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{record.ashtavidhaPariksha.nadi}</p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-900/10 bg-[#fcfbf7]">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-1">
                  <span>2.</span>
                  <span>Jihva (Tongue Examination)</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{record.ashtavidhaPariksha.jihva}</p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-900/10 bg-[#fcfbf7]">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-1">
                  <span>3.</span>
                  <span>Sparsha (Tactile / Skin Assessment)</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{record.ashtavidhaPariksha.sparsha}</p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-900/10 bg-[#fcfbf7]">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-1">
                  <span>4.</span>
                  <span>Shabda (Voice & Respiratory Sound)</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{record.ashtavidhaPariksha.shabda}</p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-900/10 bg-[#fcfbf7]">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-1">
                  <span>5.</span>
                  <span>Druk (Eye & Visual Examination)</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{record.ashtavidhaPariksha.druk}</p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-900/10 bg-[#fcfbf7]">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-1">
                  <span>6.</span>
                  <span>Akruti (Physical Constitution / Gait)</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{record.ashtavidhaPariksha.akruti}</p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-900/10 bg-[#fcfbf7]">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-1">
                  <span>7.</span>
                  <span>Mutra (Urine Examination)</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{record.ashtavidhaPariksha.mutra}</p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-900/10 bg-[#fcfbf7]">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-1">
                  <span>8.</span>
                  <span>Mala (Fecal / Bowel Assessment)</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{record.ashtavidhaPariksha.mala}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Chikitsa & Prescriptions */}
        {activeTab === "chikitsa" && (
          <div className="space-y-6">
            {/* Prescriptions Table */}
            <div className="bg-white rounded-2xl border border-[#2d513e]/15 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-serif font-bold text-[#143826]">
                    Prescribed Classical Ayurvedic Formulations
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
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
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700 font-semibold">
                      <th className="py-3 px-4">Medicine / Formulation</th>
                      <th className="py-3 px-3">Dosage</th>
                      <th className="py-3 px-3">Frequency</th>
                      <th className="py-3 px-4">Timing & Anupana</th>
                      <th className="py-3 px-3 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {record.prescriptions.map((rx, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-bold text-[#143826] font-serif text-sm">
                          {rx.item}
                        </td>
                        <td className="py-3.5 px-3 text-slate-700 font-medium">{rx.dosage}</td>
                        <td className="py-3.5 px-3 text-slate-700">{rx.frequency}</td>
                        <td className="py-3.5 px-4 text-slate-600">{rx.timing}</td>
                        <td className="py-3.5 px-3 text-right font-semibold text-emerald-900">
                          {rx.duration}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommended Clinic Therapies */}
            <div className="bg-white rounded-2xl border border-[#2d513e]/15 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-serif font-bold text-[#143826]">
                    Recommended Clinical Therapies for Care Plan
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
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
                    className="p-4 rounded-xl border border-emerald-900/15 bg-gradient-to-br from-white to-emerald-50/30 shadow-xs"
                  >
                    <p className="text-xs font-bold text-[#143826] font-serif">{th.therapy}</p>
                    <p className="text-xs text-emerald-900 font-semibold mt-1">
                      Course: {th.targetDays} Consecutive Days
                    </p>
                    <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">{th.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Dated Addenda */}
        {activeTab === "addenda" && (
          <div className="bg-white rounded-2xl border border-[#2d513e]/15 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-serif font-bold text-[#143826]">
                  Signed Consultation Addendum Ledger
                </h2>
                <p className="text-xs text-slate-600 mt-1">
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
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-500">No addenda recorded for this consultation.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {record.addenda.map((add) => (
                  <div
                    key={add.id}
                    className="border-l-4 border-emerald-700 bg-[#fcfbf7] p-4 rounded-r-xl border border-y-[#2d513e]/10 border-r-[#2d513e]/10 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#143826] font-serif">{add.authorName}</span>
                        <span className="text-slate-500">({add.authorRole})</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100/70 text-emerald-900 font-semibold text-[10px]">
                          Reason: {add.reason}
                        </span>
                      </div>
                      <span className="text-slate-500 font-mono text-[11px]">
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

      {/* Modal: Add Dated Addendum */}
      {showAddendumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-green-900/20 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-serif font-bold text-[#143826]">
                  Record Dated Addendum
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Clinical Reason
                </label>
                <select
                  value={addendumReason}
                  onChange={(e) => setAddendumReason(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                >
                  <option value="Clarification">Clarification of prescribed regimen</option>
                  <option value="Laboratory Result">Laboratory / Diagnostic investigation update</option>
                  <option value="Patient Tolerance Review">Patient tolerance or symptom progression</option>
                  <option value="Dietary Guidance">Supplementary dietary & lifestyle instruction</option>
                  <option value="Correction of Clerical Error">Correction of typographical entry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Addendum Statement
                </label>
                <textarea
                  required
                  rows={4}
                  value={addendumBody}
                  onChange={(e) => setAddendumBody(e.target.value)}
                  placeholder="Enter explicit clinical observation or addendum detail..."
                  className="w-full text-xs rounded-xl border border-slate-300 p-3 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826] leading-relaxed"
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
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
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
