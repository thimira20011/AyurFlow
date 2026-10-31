"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Appointment {
  id: string;
  patientId: string;
  name: string;
  nic: string;
  age: number;
  gender: string;
  dosha: "Vata-Pitta" | "Pitta-Kapha" | "Kapha-Vata" | "Tridoshic";
  treatment: string;
  stage: string;
  room: string;
  therapist: string;
  time: string;
  status: "In Progress" | "Waiting" | "Completed" | "Scheduled";
}

const initialAppointments: Appointment[] = [
  {
    id: "APT-2026-104",
    patientId: "AYUR-2026-0142",
    name: "K. M. Bandara",
    nic: "198814200450",
    age: 46,
    gender: "Male",
    dosha: "Vata-Pitta",
    treatment: "Shirodhara & Full-Body Abhyanga",
    stage: "Stage 2 · Snehana",
    room: "Therapy Room 02",
    therapist: "Th. K. Perera",
    time: "09:30 AM – 10:45 AM",
    status: "In Progress",
  },
  {
    id: "APT-2026-105",
    patientId: "AYUR-2026-0128",
    name: "S. D. Jayawardena",
    nic: "199468200192",
    age: 32,
    gender: "Female",
    dosha: "Pitta-Kapha",
    treatment: "Kashaya Dhara & Herbal Steam (Swedana)",
    stage: "Stage 2 · Swedana",
    room: "Therapy Room 01",
    therapist: "Th. M. Fernando",
    time: "10:00 AM – 11:15 AM",
    status: "In Progress",
  },
  {
    id: "APT-2026-106",
    patientId: "AYUR-2026-0105",
    name: "Nimali Perera",
    nic: "197951200843",
    age: 55,
    gender: "Female",
    dosha: "Kapha-Vata",
    treatment: "Kati Basti for Lumbar Rejuvenation",
    stage: "Stage 3 · Pradhana",
    room: "Therapy Room 03",
    therapist: "Th. S. Wickrama",
    time: "10:30 AM – 11:30 AM",
    status: "Waiting",
  },
  {
    id: "APT-2026-107",
    patientId: "AYUR-2026-0150",
    name: "P. R. Gunasekara",
    nic: "200109400211",
    age: 25,
    gender: "Male",
    dosha: "Vata-Pitta",
    treatment: "Initial Dosha Assessment & Pulse Diagnosis",
    stage: "Stage 1 · Assessment",
    room: "Consultation 01",
    therapist: "Dr. A. Senanayake",
    time: "11:00 AM – 11:45 AM",
    status: "Waiting",
  },
  {
    id: "APT-2026-101",
    patientId: "AYUR-2026-0099",
    name: "Chandana Silva",
    nic: "198219400231",
    age: 44,
    gender: "Male",
    dosha: "Tridoshic",
    treatment: "Mukha Lepanam & Nasyam Cleansing",
    stage: "Stage 4 · Rasayana",
    room: "Therapy Room 02",
    therapist: "Th. K. Perera",
    time: "08:15 AM – 09:15 AM",
    status: "Completed",
  },
  {
    id: "APT-2026-102",
    patientId: "AYUR-2026-0087",
    name: "Anoma Weerasinghe",
    nic: "196851200991",
    age: 58,
    gender: "Female",
    dosha: "Vata-Pitta",
    treatment: "Janu Basti (Bilateral Knee Therapy)",
    stage: "Stage 3 · Intensive",
    room: "Therapy Room 04",
    therapist: "Th. H. Dissanayake",
    time: "08:30 AM – 09:30 AM",
    status: "Completed",
  },
];

export default function DashboardPage() {
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [tableSearch, setTableSearch] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-LK", {
        timeZone: "Asia/Colombo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const dateStr = now.toLocaleDateString("en-LK", {
        timeZone: "Asia/Colombo",
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      setCurrentTime(`${dateStr} · ${timeStr} (SLST)`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const markCompleted = (id: string, name: string) => {
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === id ? { ...apt, status: "Completed" } : apt))
    );
    showToast(`✓ Session for ${name} marked as completed and cleared for billing.`);
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchesStatus =
      statusFilter === "All" ? true : apt.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch =
      !tableSearch ||
      apt.name.toLowerCase().includes(tableSearch.toLowerCase()) ||
      apt.patientId.toLowerCase().includes(tableSearch.toLowerCase()) ||
      apt.treatment.toLowerCase().includes(tableSearch.toLowerCase()) ||
      apt.room.toLowerCase().includes(tableSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0c1f16] text-emerald-200 border border-emerald-500/30 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <svg className="w-5 h-5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ── Sub-Navigation Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-green-900/10 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            Clinic Staff Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#183a2d]">
            Clinic Dashboard
          </h1>
        </div>

        {/* Local time badge */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-white border border-green-900/15 px-3 py-1.5 rounded-xl shadow-xs text-xs text-slate-700 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span>{currentTime || "Asia/Colombo · UTC+05:30"}</span>
        </div>
      </div>


      {/* ── Top Hero Banner (Botanical Theme from Auth) ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1f16] via-[#122e21] to-[#183a2d] text-white p-6 sm:p-8 shadow-xl border border-emerald-900/40">
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-40 -bottom-20 w-64 h-64 rounded-full bg-teal-400/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Colombo Clinic · Morning Session
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Ayubowan, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-green-100">Dr. Senanayake</span> 🙏
            </h2>
            <p className="text-emerald-100/75 text-sm sm:text-base max-w-2xl leading-relaxed">
              Colombo Central Ayurvedic Medical Centre. You have{" "}
              <span className="font-semibold text-white underline decoration-emerald-400 underline-offset-4">
                4 active sessions
              </span>{" "}
              in progress and 2 patients waiting in the reception lounge.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
            <Link
              href="/patients"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#23745b] to-[#10b981] hover:from-[#2d9170] hover:to-[#34d399] text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-950/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" x2="19" y1="8" y2="14" />
                <line x1="22" x2="16" y1="11" y2="11" />
              </svg>
              <span>Register Patient</span>
            </Link>

            <Link
              href="/scheduling"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-emerald-100 border border-white/15 text-xs sm:text-sm font-semibold backdrop-blur-xs transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M16 2v4" />
                <path d="M8 2v4" />
                <path d="M3 10h18" />
              </svg>
              <span>Book Session</span>
            </Link>

            <Link
              href="/inventory"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 text-xs sm:text-sm font-semibold transition-all"
              title="2 Low Stock Botanical Batches"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Dispensary (2 Alerts)</span>
            </Link>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-emerald-800/40 flex flex-wrap items-center justify-between gap-4 text-xs text-emerald-200/80">
          <div className="flex items-center gap-2">
            <span className="text-base">🌿</span>
            <span>
              <strong className="text-emerald-100">Ritucharya:</strong> Sharad Ritu transition · Humidity 78% · Emphasize Pitta-pacifying medicated cooling oils.
            </span>
          </div>
          <div className="flex items-center gap-4 text-emerald-300 font-mono text-[11px]">
            <span>DEC02 Clinical Baseline</span>
            <span>•</span>
            <span>Single Ordered Pathway</span>
          </div>
        </div>
      </div>

      {/* ── 4 KPI Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* 1. Today's Consultations */}
        <div className="rounded-2xl bg-white p-5 border border-green-900/10 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today&apos;s Consultations
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#183a2d]">24</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
              +12% vs yest.
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            18 completed · 4 in therapy · 2 waiting
          </p>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: "75%" }} />
          </div>
        </div>

        {/* 2. Active Treatment Pathways */}
        <div className="rounded-2xl bg-white p-5 border border-green-900/10 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Panchakarma Pathways
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                <path d="M12 5v16" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#183a2d]">38</span>
            <span className="text-xs font-semibold text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded-full">
              Single Pathway
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            14 Snehana · 12 Swedana · 8 Detox · 4 Rasayana
          </p>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
            <div className="bg-emerald-500 h-1.5" style={{ width: "37%" }} />
            <div className="bg-teal-500 h-1.5" style={{ width: "32%" }} />
            <div className="bg-amber-500 h-1.5" style={{ width: "21%" }} />
            <div className="bg-indigo-500 h-1.5" style={{ width: "10%" }} />
          </div>
        </div>

        {/* 3. Botanical Batch Health */}
        <div className="rounded-2xl bg-white p-5 border border-green-900/10 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Dispensary Batches
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2v20" />
                <path d="M18 2v20" />
                <path d="M6 12h12" />
                <path d="M9 7h6" />
                <path d="M9 17h6" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#183a2d]">48</span>
            <span className="text-xs font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
              2 Batches Low
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Mahanarayan Taila & Brahmi Ghrita
          </p>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: "88%" }} />
          </div>
        </div>

        {/* 4. Today's Billing Receipts */}
        <div className="rounded-2xl bg-white p-5 border border-green-900/10 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today&apos;s Receipts
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-bold text-slate-500 font-mono">LKR</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#183a2d]">184,500</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            8 Invoices issued · Direct receipts only
          </p>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#23745b] h-1.5 rounded-full" style={{ width: "100%" }} />
          </div>
        </div>
      </div>

      {/* ── Main Dashboard Columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column (8 cols): Appointments Queue & Pathways */}
        <div className="lg:col-span-8 space-y-6 sm:space-y-8">
          {/* Today's Appointments & Treatment Queue Card */}
          <div className="rounded-3xl bg-white border border-green-900/10 shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-bold text-[#183a2d]">
                    Today&apos;s Clinic Queue & Sessions
                  </h3>
                  <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                    {appointments.length} Total
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Room clearance and therapist assignment across treatment stages (AT06–07).
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#f6f7f2] p-1 rounded-xl border border-slate-200/60 text-xs font-medium">
                {["All", "In Progress", "Waiting", "Completed"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      statusFilter === tab
                        ? "bg-white text-emerald-900 font-semibold shadow-xs border border-slate-200/80"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Search */}
            <div className="px-5 sm:px-6 py-3 bg-[#fbfcf9] border-b border-slate-100 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filter by patient, NIC, room..."
                  className="w-full text-xs pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-emerald-600"
                />
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Showing {filteredAppointments.length} of {appointments.length}
              </span>
            </div>

            {/* Table / List */}
            <div className="divide-y divide-slate-100 overflow-x-auto">
              {filteredAppointments.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <p className="text-sm font-medium">No sessions match the selected filter.</p>
                </div>
              ) : (
                filteredAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 sm:p-5 hover:bg-emerald-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          apt.status === "In Progress"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : apt.status === "Waiting"
                            ? "bg-sky-100 text-sky-800 border border-sky-300"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        }`}
                      >
                        {apt.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#183a2d]">{apt.name}</span>
                          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {apt.patientId}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              apt.dosha === "Vata-Pitta"
                                ? "bg-purple-100 text-purple-800"
                                : apt.dosha === "Pitta-Kapha"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {apt.dosha}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 font-medium mt-1">
                          {apt.treatment}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-mono">
                          <span>{apt.stage}</span>
                          <span>•</span>
                          <span className="text-emerald-800 font-semibold">{apt.room}</span>
                          <span>•</span>
                          <span>{apt.therapist}</span>
                          <span>•</span>
                          <span className="text-slate-600">{apt.time}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          apt.status === "In Progress"
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : apt.status === "Waiting"
                            ? "bg-sky-100 text-sky-900 border border-sky-300"
                            : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        }`}
                      >
                        {apt.status === "In Progress" && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        )}
                        {apt.status === "Waiting" && (
                          <span className="w-2 h-2 rounded-full bg-sky-500" />
                        )}
                        {apt.status === "Completed" && (
                          <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        )}
                        {apt.status}
                      </span>

                      {apt.status !== "Completed" ? (
                        <button
                          onClick={() => markCompleted(apt.id, apt.name)}
                          className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#23745b] hover:bg-[#183a2d] text-white shadow-xs transition-colors"
                        >
                          Complete
                        </button>
                      ) : (
                        <Link
                          href="/billing"
                          className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          Receipt →
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-[#fbfcf9] border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Room concurrency strictly enforced via PostgreSQL transactions (AT06).</span>
              <Link href="/scheduling" className="font-semibold text-emerald-800 hover:text-emerald-900">
                Open full schedule view →
              </Link>
            </div>
          </div>

          {/* Ayurvedic Care Pathway Flow Card */}
          <div className="rounded-3xl bg-white border border-green-900/10 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#183a2d]">
                  Single Ordered Care Pathway Flow
                </h3>
                <p className="text-xs text-slate-500">
                  Guarded stage advancement under clinician decision & approval (AT04–05).
                </p>
              </div>
              <Link href="/clinical" className="text-xs font-semibold text-emerald-800 hover:underline">
                Manage Pathway →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 mt-5">
              {[
                {
                  step: "01",
                  title: "Poorva Karma",
                  sub: "Assessment & Deepana",
                  count: 14,
                  color: "border-emerald-600 bg-emerald-50/60",
                  badge: "bg-emerald-600 text-white",
                },
                {
                  step: "02",
                  title: "Snehana / Swedana",
                  sub: "Internal/External Oleation",
                  count: 12,
                  color: "border-teal-600 bg-teal-50/60",
                  badge: "bg-teal-600 text-white",
                },
                {
                  step: "03",
                  title: "Pradhana Karma",
                  sub: "Primary Purification (Basti)",
                  count: 8,
                  color: "border-amber-600 bg-amber-50/60",
                  badge: "bg-amber-600 text-white",
                },
                {
                  step: "04",
                  title: "Paschat Karma",
                  sub: "Samsarjana & Rasayana",
                  count: 4,
                  color: "border-indigo-600 bg-indigo-50/60",
                  badge: "bg-indigo-600 text-white",
                },
              ].map((st) => (
                <div
                  key={st.step}
                  className={`p-4 rounded-2xl border-l-4 ${st.color} border border-slate-200/70 shadow-xs`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${st.badge}`}>
                      STAGE {st.step}
                    </span>
                    <span className="text-base font-extrabold text-[#183a2d] font-mono">
                      {st.count} pts
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-[#183a2d] mt-2.5">{st.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{st.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Dispensary, Billing & Audit Stream */}
        <div className="lg:col-span-4 space-y-6 sm:space-y-8">
          {/* Dispensary Batches */}
          <div className="rounded-3xl bg-white border border-green-900/10 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                  ⚗️
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#183a2d]">Dispensary Batches</h3>
                  <p className="text-[11px] text-slate-500">Lot consumption tracking (AT08–11)</p>
                </div>
              </div>
              <Link href="/inventory" className="text-xs font-semibold text-emerald-800 hover:underline">
                View All →
              </Link>
            </div>

            <div className="space-y-3 mt-4">
              {[
                {
                  name: "Ashwagandha Arishta",
                  batch: "BATCH-AA-042",
                  qty: "2,400g / 3,000g",
                  pct: 80,
                  status: "Healthy",
                  badge: "bg-emerald-100 text-emerald-800",
                },
                {
                  name: "Mahanarayan Taila",
                  batch: "BATCH-MT-019",
                  qty: "380g / 2,500g",
                  pct: 15,
                  status: "Low Stock Alert",
                  badge: "bg-amber-100 text-amber-800 animate-pulse",
                },
                {
                  name: "Triphala Churna",
                  batch: "BATCH-TC-033",
                  qty: "1,250g / 2,000g",
                  pct: 62,
                  status: "Healthy",
                  badge: "bg-emerald-100 text-emerald-800",
                },
                {
                  name: "Brahmi Ghrita",
                  batch: "BATCH-BG-011",
                  qty: "180g / 1,500g",
                  pct: 12,
                  status: "Critical Reorder",
                  badge: "bg-rose-100 text-rose-800 font-bold",
                },
              ].map((item) => (
                <div key={item.batch} className="p-3 rounded-xl bg-[#fbfcf9] border border-slate-200/70 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{item.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${item.badge}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px] mt-1 font-mono">
                    <span>{item.batch}</span>
                    <span>{item.qty}</span>
                  </div>
                  <div className="mt-2 w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                    <div
                      className={`h-1 rounded-full ${
                        item.pct < 20 ? "bg-rose-500" : item.pct < 30 ? "bg-amber-500" : "bg-emerald-600"
                      }`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              <strong>Dispensary Policy (DEC03):</strong> Manual batch selection under verified lot scale. No automatic negative deductions.
            </div>
          </div>

          {/* Direct Receipts */}
          <div className="rounded-3xl bg-white border border-green-900/10 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  🧾
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#183a2d]">Direct Receipts</h3>
                  <p className="text-[11px] text-slate-500">Atomic issue & settlements (AT12–13)</p>
                </div>
              </div>
              <Link href="/billing" className="text-xs font-semibold text-emerald-800 hover:underline">
                Ledger →
              </Link>
            </div>

            <div className="space-y-3 mt-4">
              {[
                {
                  inv: "INV-2026-089",
                  rec: "REC-2026-0042",
                  name: "S. D. Jayawardena",
                  amount: "LKR 18,500.00",
                  status: "Receipt Issued",
                  color: "text-emerald-700 bg-emerald-50",
                },
                {
                  inv: "INV-2026-090",
                  rec: "REC-2026-0043",
                  name: "K. M. Bandara",
                  amount: "LKR 24,000.00",
                  status: "Direct Deposit",
                  color: "text-teal-700 bg-teal-50",
                },
                {
                  inv: "INV-2026-091",
                  rec: "Pending",
                  name: "D. Senaratne",
                  amount: "LKR 12,000.00",
                  status: "Awaiting Payment",
                  color: "text-amber-800 bg-amber-50",
                },
              ].map((rc) => (
                <div key={rc.inv} className="p-3 rounded-xl bg-[#fbfcf9] border border-slate-200/70 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{rc.name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${rc.color}`}>
                      {rc.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px] mt-1 font-mono">
                    <span>{rc.inv}</span>
                    <span className="font-bold text-slate-900">{rc.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Immutable Audit Stream */}
          <div className="rounded-3xl bg-[#0c1f16] text-white p-5 sm:p-6 shadow-md border border-emerald-900/60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-sm font-bold text-white">Immutable Audit Stream</h3>
              </div>
              <span className="text-[10px] text-emerald-400/80 font-mono">TASK-SET-05</span>
            </div>

            <div className="space-y-3 text-xs">
              {[
                {
                  time: "10:14 AM",
                  user: "Dr. Senanayake",
                  action: "Signed addendum for AYUR-2026-0142",
                },
                {
                  time: "09:42 AM",
                  user: "Dispensary Staff",
                  action: "Recorded 120g batch consumption",
                },
                {
                  time: "09:05 AM",
                  user: "Reception Desk",
                  action: "Registered patient AYUR-2026-0150",
                },
                {
                  time: "08:30 AM",
                  user: "Billing Cashier",
                  action: "Issued receipt REC-2026-0042",
                },
              ].map((log, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-[11px] text-emerald-100/75 border-b border-emerald-950/80 pb-2">
                  <span className="font-mono text-emerald-400 shrink-0">{log.time}</span>
                  <div>
                    <span className="font-semibold text-white">{log.user}: </span>
                    <span>{log.action}</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-emerald-400/60 mt-4 leading-relaxed">
              Critical audit records insert within the same transaction as mutations (AT13).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
