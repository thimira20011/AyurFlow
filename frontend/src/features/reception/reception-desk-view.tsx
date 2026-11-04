"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface UpcomingSession {
  id: string;
  time: string;
  patient: string;
  patientId: string;
  therapist: string;
  room: string;
  status: "Booked" | "In Therapy" | "Completed" | "Arrived";
  treatment: string;
  dosha?: string;
}

const initialSessions: UpcomingSession[] = [
  {
    id: "SES-2026-001",
    time: "09:30",
    patient: "Nimali Perera",
    patientId: "AYUR-2026-0105",
    therapist: "Demo Therapist A",
    room: "Treatment room 01",
    status: "Booked",
    treatment: "Kati Basti · Lumbar Spine Therapy",
    dosha: "Kapha-Vata",
  },
  {
    id: "SES-2026-002",
    time: "10:30",
    patient: "Saman Jayasinghe",
    patientId: "AYUR-2026-0142",
    therapist: "Demo Therapist B",
    room: "Treatment room 02",
    status: "Booked",
    treatment: "Shirodhara & Herbal Infusion",
    dosha: "Vata-Pitta",
  },
  {
    id: "SES-2026-003",
    time: "11:00",
    patient: "Amali Silva",
    patientId: "AYUR-2026-0099",
    therapist: "Demo Therapist A",
    room: "Treatment room 01",
    status: "Booked",
    treatment: "Mukha Lepanam & Nasyam",
    dosha: "Tridoshic",
  },
];

export function ReceptionDeskView() {
  const [sessions, setSessions] = useState<UpcomingSession[]>(initialSessions);
  const [selectedSession, setSelectedSession] = useState<UpcomingSession | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [currentDateStr, setCurrentDateStr] = useState<string>("28 Oct 2026 · Asia/Colombo");
  const [dayHeadingStr, setDayHeadingStr] = useState<string>("WEDNESDAY, 28 OCTOBER");
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // New patient registration form state
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientNic, setNewPatientNic] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newPatientTherapy, setNewPatientTherapy] = useState("Consultation 01");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleDateString("en-LK", {
        timeZone: "Asia/Colombo",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const dayUpper = now.toLocaleDateString("en-LK", {
        timeZone: "Asia/Colombo",
        weekday: "long",
        day: "numeric",
        month: "long",
      }).toUpperCase();
      setCurrentDateStr(`${timeStr} · Asia/Colombo`);
      setDayHeadingStr(dayUpper);
    };
    updateTime();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) return;

    const newId = `AYUR-2026-${String(100 + sessions.length + 1).padStart(4, "0")}`;
    const newSessionItem: UpcomingSession = {
      id: `SES-2026-${String(sessions.length + 1).padStart(3, "0")}`,
      time: "11:30",
      patient: newPatientName.trim(),
      patientId: newId,
      therapist: "Demo Therapist B",
      room: newPatientTherapy,
      status: "Arrived",
      treatment: "Initial Dosha Assessment & Pulse Consultation",
      dosha: "Vata-Pitta",
    };

    setSessions((prev) => [...prev, newSessionItem]);
    setShowRegisterModal(false);
    setNewPatientName("");
    setNewPatientNic("");
    setNewPatientPhone("");
    triggerToast(`✓ Registered ${newSessionItem.patient} (${newId}) and queued for consultation.`);
  };

  const toggleCheckIn = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const nextStatus = s.status === "Booked" ? "Arrived" : s.status === "Arrived" ? "In Therapy" : "Booked";
          return { ...s, status: nextStatus };
        }
        return s;
      })
    );
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f6efe4] text-[#1c2820] font-sans antialiased selection:bg-[#d9e6d8] selection:text-[#143826]">
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#143826] text-[#f4efe6] border border-[#2d5941] px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-emerald-400">🌿</span>
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. LEFT SIDEBAR (Dark Forest Green: #143826)
         ───────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#143826] text-white flex flex-col justify-between p-6 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <Link href="/reception" className="flex items-center gap-3 group">
              {/* Sprout Logo */}
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
          <nav className="mt-5 space-y-1.5" aria-label="Reception Desk Navigation">
            {/* Overview (Active) */}
            <Link
              href="/reception"
              className="flex items-center px-4 py-2.5 rounded-xl bg-[#f3efe6] text-[#143826] font-semibold text-sm shadow-xs transition-colors"
            >
              <span>Overview</span>
            </Link>

            {/* Patients */}
            <Link
              href="/patients"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
            >
              <span>Patients</span>
            </Link>

            {/* Schedule */}
            <Link
              href="/scheduling"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
            >
              <span>Schedule</span>
            </Link>

            {/* Consultations */}
            <Link
              href="/clinical"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
            >
              <span>Consultations</span>
            </Link>

            {/* Care Plans */}
            <Link
              href="/clinical/plans"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
            >
              <span>Care Plans</span>
            </Link>

            {/* Billing */}
            <Link
              href="/billing"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
            >
              <span>Billing & Invoices</span>
            </Link>

            {/* Dashboard */}
            <Link
              href="/dashboard"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
            >
              <span>Clinic Dashboard</span>
            </Link>
          </nav>

          {/* Botanical Herbal Plant Drawing in Left Sidebar */}
          <div className="mt-8 flex justify-center py-2" aria-hidden="true">
            <svg
              width="100"
              height="155"
              viewBox="0 0 110 170"
              fill="none"
              stroke="#5b806b"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-75"
            >
              <path d="M22 153C35 166 75 166 88 153" />
              <path d="M24 151H86" />
              <path d="M55 151V20" />
              <path d="M55 136C30 130 25 113 35 103C48 106 53 123 55 136Z" />
              <path d="M55 136C80 130 85 113 75 103C62 106 57 123 55 136Z" />
              <path d="M55 103C33 98 30 83 40 74C50 77 53 92 55 103Z" />
              <path d="M55 103C77 98 80 83 70 74C60 77 57 92 55 103Z" />
              <path d="M55 73C36 69 34 56 43 49C51 52 53 64 55 73Z" />
              <path d="M55 73C74 69 76 56 67 49C59 52 57 64 55 73Z" />
              <path d="M55 46C40 42 38 32 46 26C52 29 54 38 55 46Z" />
              <path d="M55 46C70 42 72 32 64 26C58 29 56 38 55 46Z" />
              <path d="M55 22C51 12 55 7 55 4C55 7 59 12 55 22Z" />
            </svg>
          </div>
        </div>

        {/* Footer in Sidebar */}
        <div className="pt-4 border-t border-[#1d4c35]">
          <p className="text-[10px] font-bold tracking-[0.2em] text-[#6d9179] uppercase">
            Single Clinic
          </p>
          <p className="mt-1 text-xs text-[#b8ccbf] leading-relaxed">
            Thoughtful care.<br />
            Connected records.
          </p>
        </div>
      </aside>

      {/* Backdrop for mobile nav */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-2xs"
          aria-hidden="true"
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN WORKSPACE AREA
         ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-14 bg-[#faf7f2] border-b border-dashed border-[#ded7c8] px-6 lg:px-10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden text-[#1c2820] hover:text-emerald-900 p-1"
              aria-label="Open sidebar navigation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-medium text-[#3b443c]">Overview</span>
          </div>

          <div className="flex items-center gap-6 sm:gap-8">
            <span className="hidden md:inline-block text-xs font-mono text-[#6e766e]">
              {currentDateStr}
            </span>

            <div className="text-right">
              <div className="text-xs sm:text-sm font-bold text-[#1c2820] leading-tight">
                Maya · Reception
              </div>
              <div className="text-[11px] text-[#7a8179]">Staff account</div>
            </div>
          </div>
        </header>

        {/* Content Canvas (Warm textured parchment) */}
        <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-6xl w-full mx-auto space-y-6 sm:space-y-8">
          {/* ── Greeting & Top Action ── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.18em] text-[#756e62] uppercase font-sans">
                <span className="text-[#96866d] text-[10px]">❖</span>
                <span>{dayHeadingStr}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif text-[#1c2820] font-normal tracking-tight mt-1">
                Good morning, Maya.
              </h1>
              <p className="text-sm text-[#5d675e] mt-1">
                A clear view of the day ahead.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowRegisterModal(true)}
                id="reception-register-patient-btn"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#143826] hover:bg-[#1a4a34] text-white text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
              >
                <span>+ Register patient</span>
              </button>
            </div>
          </div>

          {/* ── Thoughtful Start Banner Card ── */}
          <div className="rounded-2xl bg-[#e9f0e7] border border-[#d2dfcf] p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xs">
            <div className="space-y-1 max-w-xl">
              <h2 className="text-lg sm:text-xl font-serif font-medium text-[#1a3424]">
                A thoughtful start to every visit
              </h2>
              <p className="text-xs sm:text-sm text-[#4e6654] leading-relaxed">
                Find a patient, review the schedule, and keep the clinic moving with care.
              </p>
            </div>

            {/* Mortar and Pestle Ayurvedic Botanical Line-art */}
            <div className="shrink-0 self-end md:self-auto" aria-hidden="true">
              <svg
                width="64"
                height="64"
                viewBox="0 0 68 68"
                fill="none"
                stroke="#6b8a73"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 36C14 49 22 55 34 55C46 55 54 49 54 36H14Z" />
                <path d="M23 55V59H45V55" />
                <ellipse cx="34" cy="36" rx="20" ry="3.5" />
                <path d="M37 36L52 14C53.5 12 55.5 12.5 56.5 14C57.5 15.5 56.5 17.5 55 19L41 38" />
                <path d="M28 34C24 28 25 21 31 19C33 24 32 30 28 34Z" />
                <path d="M22 34C18 30 17 24 21 21C24 24 24 29 22 34Z" />
                <path d="M34 34C35 29 39 24 44 25C43 29 39 33 34 34Z" />
              </svg>
            </div>
          </div>

          {/* ── 3 KPI Metric Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            <div className="rounded-2xl bg-[#fdfbf7] border border-[#e7e0d3] p-6 shadow-2xs">
              <div className="text-4xl font-serif text-[#1c2e22] font-normal leading-none">
                {String(sessions.length + 9).padStart(2, "0")}
              </div>
              <div className="mt-3 text-xs sm:text-sm text-[#6c746c] font-medium">
                Sessions today
              </div>
            </div>

            <div className="rounded-2xl bg-[#fdfbf7] border border-[#e7e0d3] p-6 shadow-2xs">
              <div className="text-4xl font-serif text-[#1c2e22] font-normal leading-none">
                {String(sessions.filter((s) => s.status === "Booked" || s.status === "Arrived").length + 3).padStart(2, "0")}
              </div>
              <div className="mt-3 text-xs sm:text-sm text-[#6c746c] font-medium">
                Expected arrivals
              </div>
            </div>

            <div className="rounded-2xl bg-[#fdfbf7] border border-[#e7e0d3] p-6 shadow-2xs">
              <div className="text-4xl font-serif text-[#1c2e22] font-normal leading-none">
                03
              </div>
              <div className="mt-3 text-xs sm:text-sm text-[#6c746c] font-medium">
                Rooms in use
              </div>
            </div>
          </div>

          {/* ── Upcoming Sessions Section ── */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#1c2820]">
                Upcoming sessions
              </h2>
              <Link
                href="/scheduling"
                className="text-xs sm:text-sm font-medium text-[#2d503d] hover:text-[#143826] hover:underline transition-colors"
              >
                View schedule
              </Link>
            </div>

            {/* Table Container */}
            <div className="rounded-2xl bg-[#fcfaf6] border border-[#e8e2d6] overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#ece7dc] border-b border-[#e4ddd0] text-[#5e665d] text-xs font-medium">
                      <th className="py-3 px-5 sm:px-6">Time</th>
                      <th className="py-3 px-5 sm:px-6">Patient</th>
                      <th className="py-3 px-5 sm:px-6">Therapist</th>
                      <th className="py-3 px-5 sm:px-6">Room</th>
                      <th className="py-3 px-5 sm:px-6">Status</th>
                      <th className="py-3 px-5 sm:px-6 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#eee9de]">
                    {sessions.map((session) => (
                      <tr
                        key={session.id}
                        className="hover:bg-[#f5efe5]/70 transition-colors group"
                      >
                        <td className="py-4 px-5 sm:px-6 font-semibold text-[#1c2820] whitespace-nowrap">
                          {session.time}
                        </td>

                        <td className="py-4 px-5 sm:px-6 font-medium text-[#1c2820] whitespace-nowrap">
                          <div>{session.patient}</div>
                          <div className="text-[11px] font-mono text-[#8a918a]">{session.patientId}</div>
                        </td>

                        <td className="py-4 px-5 sm:px-6 text-[#4a534c] whitespace-nowrap">
                          {session.therapist}
                        </td>

                        <td className="py-4 px-5 sm:px-6 text-[#4a534c] whitespace-nowrap">
                          {session.room}
                        </td>

                        <td className="py-4 px-5 sm:px-6 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleCheckIn(session.id)}
                            title="Click to advance status"
                            className={`inline-block px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer border ${
                              session.status === "Arrived"
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : session.status === "In Therapy"
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                : "bg-[#eae4d8] text-[#49524a] border-[#dfd8cb] hover:bg-[#e2dccf]"
                            }`}
                          >
                            {session.status}
                          </button>
                        </td>

                        <td className="py-4 px-5 sm:px-6 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedSession(session)}
                            className="inline-flex items-center gap-1 text-[#2d503d] hover:text-[#143826] font-medium text-xs sm:text-sm group-hover:underline cursor-pointer"
                          >
                            <span>View session</span>
                            <span aria-hidden="true">→</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. SESSION DETAILS MODAL
         ───────────────────────────────────────────────────────────── */}
      {selectedSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in"
          onClick={() => setSelectedSession(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-modal-title"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#fcfaf6] border border-[#e8e2d6] p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#eee9de] pb-3">
              <div>
                <span className="text-[11px] font-semibold tracking-wider text-[#799a84] uppercase">
                  Session Details
                </span>
                <h3 id="session-modal-title" className="text-xl font-serif text-[#1c2820] mt-0.5">
                  {selectedSession.patient}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="text-[#6c746c] hover:text-[#1c2820] p-1 rounded-md cursor-pointer"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div>
                <dt className="text-[#757d75] text-xs">Patient ID</dt>
                <dd className="font-mono font-medium text-[#1c2820]">{selectedSession.patientId}</dd>
              </div>
              <div>
                <dt className="text-[#757d75] text-xs">Time Scheduled</dt>
                <dd className="font-semibold text-[#1c2820]">{selectedSession.time} (Asia/Colombo)</dd>
              </div>
              <div>
                <dt className="text-[#757d75] text-xs">Treatment Room</dt>
                <dd className="text-[#1c2820]">{selectedSession.room}</dd>
              </div>
              <div>
                <dt className="text-[#757d75] text-xs">Assigned Therapist</dt>
                <dd className="text-[#1c2820]">{selectedSession.therapist}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[#757d75] text-xs">Treatment Planned</dt>
                <dd className="font-medium text-[#1c2820]">{selectedSession.treatment}</dd>
              </div>
              {selectedSession.dosha && (
                <div className="col-span-2">
                  <dt className="text-[#757d75] text-xs">Prakriti / Dosha State</dt>
                  <dd className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-[#e9f0e7] text-[#1a3424] text-xs font-medium">
                    {selectedSession.dosha}
                  </dd>
                </div>
              )}
            </dl>

            <div className="pt-3 border-t border-[#eee9de] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  toggleCheckIn(selectedSession.id);
                  setSelectedSession(null);
                  triggerToast(`Updated check-in status for ${selectedSession.patient}`);
                }}
                className="text-xs text-[#2d503d] hover:underline font-semibold cursor-pointer"
              >
                Toggle Arrival Status
              </button>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 rounded-xl bg-[#143826] text-white text-xs font-semibold hover:bg-[#1a4a34] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. QUICK REGISTER PATIENT MODAL
         ───────────────────────────────────────────────────────────── */}
      {showRegisterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in"
          onClick={() => setShowRegisterModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-modal-title"
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#fcfaf6] border border-[#e8e2d6] p-6 sm:p-7 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#eee9de] pb-3">
              <div>
                <span className="text-[11px] font-semibold tracking-wider text-[#799a84] uppercase">
                  Reception Desk Intake
                </span>
                <h3 id="register-modal-title" className="text-xl sm:text-2xl font-serif text-[#1c2820] mt-0.5">
                  Register Walk-in Patient
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="text-[#6c746c] hover:text-[#1c2820] p-1 rounded-md cursor-pointer"
                aria-label="Close registration"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#4a534c] uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. K. M. Bandara"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#d6cfc1] bg-[#f7f2ea] text-sm text-[#1c2820] focus:bg-white focus:border-[#143826] focus:outline-hidden transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4a534c] uppercase tracking-wider mb-1">
                    NIC or Passport (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="198814200450"
                    value={newPatientNic}
                    onChange={(e) => setNewPatientNic(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#d6cfc1] bg-[#f7f2ea] text-sm text-[#1c2820] focus:bg-white focus:border-[#143826] focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4a534c] uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+94 77 123 4567"
                    value={newPatientPhone}
                    onChange={(e) => setNewPatientPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#d6cfc1] bg-[#f7f2ea] text-sm text-[#1c2820] focus:bg-white focus:border-[#143826] focus:outline-hidden transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4a534c] uppercase tracking-wider mb-1">
                  Initial Assignment
                </label>
                <select
                  value={newPatientTherapy}
                  onChange={(e) => setNewPatientTherapy(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#d6cfc1] bg-[#f7f2ea] text-sm text-[#1c2820] focus:bg-white focus:border-[#143826] focus:outline-hidden transition"
                >
                  <option value="Consultation 01">Consultation Room 01 (Dr. Senanayake)</option>
                  <option value="Treatment room 01">Treatment Room 01 (Demo Therapist A)</option>
                  <option value="Treatment room 02">Treatment Room 02 (Demo Therapist B)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#eee9de] flex items-center justify-between gap-3">
                <Link
                  href="/patients?action=register"
                  className="text-xs text-[#2d503d] hover:underline font-medium"
                >
                  Open Full Registry Form →
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-[#5c655d] hover:bg-[#eee8dd] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#143826] hover:bg-[#1a4a34] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    Register & Check In
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
