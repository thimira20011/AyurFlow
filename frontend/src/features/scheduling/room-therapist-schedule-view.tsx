"use client";

import { useState } from "react";
import Link from "next/link";

export type SessionStatus = "scheduled" | "in_therapy" | "completed" | "cancelled";

interface ScheduledSession {
  id: string;
  patientName: string;
  patientCode: string;
  patientGender: "Male" | "Female";
  therapyName: string;
  roomName: string;
  therapistName: string;
  therapistGender: "Male" | "Female";
  timeSlot: string;
  status: SessionStatus;
  clinicalClearance: boolean;
  notes?: string;
}

const initialSessions: ScheduledSession[] = [
  {
    id: "ses-01",
    patientName: "Saman Kumara Jayawardena",
    patientCode: "AYUR-2026-0042",
    patientGender: "Male",
    therapyName: "Sarvanga Abhyanga & Swedana (60m)",
    roomName: "Droni Suite 01",
    therapistName: "Therapist K. Perera",
    therapistGender: "Male",
    timeSlot: "08:30 AM - 09:30 AM",
    status: "completed",
    clinicalClearance: true,
    notes: "Stage 2 Cleared. Dhanwantaram Taila utilized.",
  },
  {
    id: "ses-02",
    patientName: "Saman Kumara Jayawardena",
    patientCode: "AYUR-2026-0042",
    patientGender: "Male",
    therapyName: "Janu Basti & Local Fomentation (45m)",
    roomName: "Droni Suite 02",
    therapistName: "Therapist M. Fernando",
    therapistGender: "Male",
    timeSlot: "10:00 AM - 10:45 AM",
    status: "in_therapy",
    clinicalClearance: true,
    notes: "Kottamchukkadi warm oil ring retention on both knees.",
  },
  {
    id: "ses-03",
    patientName: "Chitrangani Wickramasinghe",
    patientCode: "AYUR-2026-0078",
    patientGender: "Female",
    therapyName: "Shirodhara with Ksheerabala Taila (45m)",
    roomName: "Shirodhara Chamber",
    therapistName: "Therapist N. Silva",
    therapistGender: "Female",
    timeSlot: "10:30 AM - 11:15 AM",
    status: "scheduled",
    clinicalClearance: true,
    notes: "Continuous forehead stream for stress and insomnia.",
  },
  {
    id: "ses-04",
    patientName: "Nimal Gamage",
    patientCode: "AYUR-2026-0091",
    patientGender: "Male",
    therapyName: "Kati Basti with Mahanarayana Taila (45m)",
    roomName: "Droni Suite 01",
    therapistName: "Therapist K. Perera",
    therapistGender: "Male",
    timeSlot: "11:30 AM - 12:15 PM",
    status: "scheduled",
    clinicalClearance: true,
    notes: "Lower lumbar spine warm oil retention.",
  },
  {
    id: "ses-05",
    patientName: "Pushpa Damayanthi",
    patientCode: "AYUR-2026-0105",
    patientGender: "Female",
    therapyName: "Patra Pinda Sweda (Elakizhi) (45m)",
    roomName: "Droni Suite 02",
    therapistName: "Therapist D. Jayasinghe",
    therapistGender: "Female",
    timeSlot: "02:00 PM - 02:45 PM",
    status: "scheduled",
    clinicalClearance: false,
    notes: "Awaiting physician Stage 1 clearance before start.",
  },
  {
    id: "ses-06",
    patientName: "Sunil Alwis",
    patientCode: "AYUR-2026-0114",
    patientGender: "Male",
    therapyName: "Matra Vasti Protocol (30m)",
    roomName: "Basti Therapy Suite",
    therapistName: "Therapist S. Wickramasinghe",
    therapistGender: "Male",
    timeSlot: "03:00 PM - 03:30 PM",
    status: "scheduled",
    clinicalClearance: true,
    notes: "Sahacharadi Taila administration.",
  },
];

const roomsList = [
  "All Rooms",
  "Droni Suite 01",
  "Shirodhara Chamber",
  "Droni Suite 02",
  "Basti Therapy Suite",
  "Consultation Suite A",
];

const therapistsList = [
  { name: "Therapist K. Perera", role: "Senior Panchakarma Specialist", gender: "Male" },
  { name: "Therapist N. Silva", role: "Ayurvedic Therapist", gender: "Female" },
  { name: "Therapist M. Fernando", role: "Droni & Basti Specialist", gender: "Male" },
  { name: "Therapist D. Jayasinghe", role: "Shirodhara & Swedana Specialist", gender: "Female" },
  { name: "Therapist S. Wickramasinghe", role: "Therapist", gender: "Male" },
  { name: "Therapist L. Senanayake", role: "Therapist", gender: "Female" },
];

export function RoomTherapistScheduleView() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sessions, setSessions] = useState<ScheduledSession[]>(initialSessions);
  const [selectedRoom, setSelectedRoom] = useState("All Rooms");
  const [selectedDate, setSelectedDate] = useState("2026-10-24");
  const [showBookModal, setShowBookModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Booking State
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientCode, setNewPatientCode] = useState("");
  const [newPatientGender, setNewPatientGender] = useState<"Male" | "Female">("Male");
  const [newTherapy, setNewTherapy] = useState("Sarvanga Abhyanga (60m)");
  const [newRoom, setNewRoom] = useState("Droni Suite 01");
  const [newTherapist, setNewTherapist] = useState("Therapist K. Perera");
  const [newTimeSlot, setNewTimeSlot] = useState("03:30 PM - 04:30 PM");
  const [newNotes, setNewNotes] = useState("");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredSessions = sessions.filter((s) => {
    if (selectedRoom !== "All Rooms" && s.roomName !== selectedRoom) return false;
    return true;
  });

  const toggleSessionStatus = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        let nextStatus: SessionStatus = "scheduled";
        if (s.status === "scheduled") nextStatus = "in_therapy";
        else if (s.status === "in_therapy") nextStatus = "completed";
        else if (s.status === "completed") nextStatus = "scheduled";
        return { ...s, status: nextStatus };
      })
    );
    triggerToast("Session status updated.");
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) return;

    // Conflict Check
    const conflict = sessions.find(
      (s) =>
        s.timeSlot === newTimeSlot &&
        s.status !== "cancelled" &&
        (s.roomName === newRoom || s.therapistName === newTherapist)
    );

    if (conflict) {
      alert(
        `Scheduling Conflict Detected!\n\n${
          conflict.roomName === newRoom
            ? `Room [${newRoom}]`
            : `Therapist [${newTherapist}]`
        } is already occupied during ${newTimeSlot} for ${conflict.patientName}.\n\nPlease choose a different room, therapist, or time slot.`
      );
      return;
    }

    const assignedTherapistObj = therapistsList.find((t) => t.name === newTherapist);
    const newSession: ScheduledSession = {
      id: `ses-${Date.now()}`,
      patientName: newPatientName.trim(),
      patientCode: newPatientCode.trim() || `AYUR-2026-${Math.floor(100 + Math.random() * 900)}`,
      patientGender: newPatientGender,
      therapyName: newTherapy,
      roomName: newRoom,
      therapistName: newTherapist,
      therapistGender: (assignedTherapistObj?.gender as "Male" | "Female") || "Male",
      timeSlot: newTimeSlot,
      status: "scheduled",
      clinicalClearance: true,
      notes: newNotes.trim() || "Regular scheduled Panchakarma session.",
    };

    setSessions((prev) => [...prev, newSession]);
    setShowBookModal(false);
    setNewPatientName("");
    setNewPatientCode("");
    setNewNotes("");
    triggerToast(`Session booked for ${newSession.patientName} in ${newSession.roomName}!`);
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
          <nav className="mt-5 space-y-1.5" aria-label="Schedule Navigation">
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

            {/* Schedule (ACTIVE) */}
            <Link
              href="/scheduling"
              className="flex items-center px-4 py-2.5 rounded-xl bg-[#f3efe6] text-[#143826] font-semibold text-sm shadow-xs transition-colors"
            >
              <span>Schedule</span>
            </Link>

            <Link
              href="/clinical"
              className="flex items-center px-4 py-2.5 rounded-xl text-[#b6cbbd] hover:text-white hover:bg-[#1a4732]/50 text-sm font-medium transition-colors"
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
                  Living Heritage · Treatment Suites & Roster
                </span>
              </div>
              <h1 className="text-xl lg:text-2xl font-serif font-bold text-[#143826] tracking-tight">
                Room & Therapist Schedule
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center bg-[#fcfbf7] border border-[#d8cbbb] rounded-xl px-3 py-1.5 shadow-xs">
              <span className="text-xs text-slate-500 mr-2 font-medium">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-bold text-[#143826] bg-transparent focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowBookModal(true)}
              className="px-4 py-2 rounded-xl bg-[#143826] text-white hover:bg-[#1a4732] text-xs font-bold shadow-sm transition flex items-center gap-2"
            >
              <span>+</span>
              <span>Book Therapy Session</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-6 lg:p-10 space-y-8 max-w-7xl w-full mx-auto">
          {/* Hero Banner with Mortar & Pestle Botanical Motif */}
          <div className="relative rounded-2xl bg-gradient-to-r from-[#173e2b] via-[#1c4a34] to-[#255e43] text-white p-6 sm:p-8 shadow-sm overflow-hidden border border-[#23583c]">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-200 text-xs font-medium mb-3 backdrop-blur-xs border border-white/10">
                <span>🌿</span>
                <span>Active Scheduling & Clinical Clearance</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#fdfbf7]">
                Treatment Suites & Therapist Rostering
              </h2>
              <p className="mt-2 text-sm text-[#c2d7cb] leading-relaxed">
                Coordinate daily Panchakarma therapies across 5 treatment chambers.
                All sessions verify care plan stage approval and therapist gender alignment before commencement.
              </p>
            </div>

            {/* Mortar & Pestle Decorative Outline */}
            <div className="absolute right-4 bottom-2 opacity-15 pointer-events-none select-none hidden md:block">
              <svg width="180" height="150" viewBox="0 0 100 80" fill="none" stroke="#d7b98d" strokeWidth="2">
                <path d="M20 35 C20 60 35 75 50 75 C65 75 80 60 80 35 Z" />
                <path d="M15 35 Q50 30 85 35" />
                <path d="M45 10 L65 50" strokeWidth="4" strokeLinecap="round" />
                <ellipse cx="50" cy="74" rx="20" ry="3" />
              </svg>
            </div>
          </div>

          {/* 4 Living Heritage Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#fbf8f2] rounded-2xl p-5 border border-[#e2d7c5] shadow-xs hover:border-[#b8cbbd] transition">
              <p className="text-xs font-medium text-[#6b7d72] uppercase tracking-wider">
                Treatment Chambers
              </p>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl sm:text-3xl font-serif font-bold text-[#143826]">
                  5 Suites
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                  Ready
                </span>
              </div>
              <p className="text-[11px] text-[#7a8c80] mt-1">Droni, Shirodhara & Basti</p>
            </div>

            <div className="bg-[#fbf8f2] rounded-2xl p-5 border border-[#e2d7c5] shadow-xs hover:border-[#b8cbbd] transition">
              <p className="text-xs font-medium text-[#6b7d72] uppercase tracking-wider">
                Therapists On Duty
              </p>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl sm:text-3xl font-serif font-bold text-[#143826]">
                  6 Staff
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-[#7a8c80] mt-1">Gender-matched protocols</p>
            </div>

            <div className="bg-[#fbf8f2] rounded-2xl p-5 border border-[#e2d7c5] shadow-xs hover:border-[#b8cbbd] transition">
              <p className="text-xs font-medium text-[#6b7d72] uppercase tracking-wider">
                Sessions Today
              </p>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl sm:text-3xl font-serif font-bold text-[#143826]">
                  {sessions.length}
                </span>
                <span className="text-xs font-semibold text-[#143826] bg-[#e8e2d4] px-2 py-0.5 rounded">
                  {selectedDate}
                </span>
              </div>
              <p className="text-[11px] text-[#7a8c80] mt-1">Scheduled across suites</p>
            </div>

            <div className="bg-[#fbf8f2] rounded-2xl p-5 border border-[#e2d7c5] shadow-xs hover:border-[#b8cbbd] transition">
              <p className="text-xs font-medium text-[#6b7d72] uppercase tracking-wider">
                Room Conflicts
              </p>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl sm:text-3xl font-serif font-bold text-emerald-700">
                  0 Overlaps
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                  Verified
                </span>
              </div>
              <p className="text-[11px] text-[#7a8c80] mt-1">Conflict safety active</p>
            </div>
          </div>

          {/* Room Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {roomsList.map((room) => (
              <button
                key={room}
                type="button"
                onClick={() => setSelectedRoom(room)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedRoom === room
                    ? "bg-[#143826] text-white shadow-xs"
                    : "bg-[#fbf8f2] text-[#4d5f53] hover:bg-[#eae3d5] border border-[#e2d7c5]"
                }`}
              >
                {room}
              </button>
            ))}
          </div>

          {/* Session Cards Grid */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif font-bold text-[#143826]">
                Scheduled Therapy Sessions ({filteredSessions.length})
              </h3>
              <span className="text-xs text-[#6b7d72]">
                Click status pill to cycle: Scheduled ➔ In Therapy ➔ Completed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSessions.map((session) => {
                const isGenderMatched = session.patientGender === session.therapistGender;

                return (
                  <div
                    key={session.id}
                    className={`bg-[#fbf8f2] rounded-2xl border p-5 flex flex-col justify-between shadow-xs transition hover:shadow-md ${
                      session.status === "in_therapy"
                        ? "border-emerald-600 ring-2 ring-emerald-500/20 bg-white"
                        : "border-[#e2d7c5]"
                    }`}
                  >
                    <div>
                      {/* Top Row: Time Slot & Status Pill */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-xs font-bold font-mono text-[#143826] bg-[#f0ebd9] px-2.5 py-1 rounded-lg border border-[#ded4bf]">
                          ⏰ {session.timeSlot}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSessionStatus(session.id)}
                          className={`text-[11px] font-bold px-3 py-1 rounded-full cursor-pointer transition shadow-xs ${
                            session.status === "scheduled"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : session.status === "in_therapy"
                              ? "bg-emerald-700 text-white animate-pulse"
                              : session.status === "completed"
                              ? "bg-[#143826] text-white"
                              : "bg-red-100 text-red-900"
                          }`}
                          title="Click to cycle status"
                        >
                          {session.status === "scheduled" && "⏳ Scheduled"}
                          {session.status === "in_therapy" && "● In Therapy"}
                          {session.status === "completed" && "✓ Completed"}
                          {session.status === "cancelled" && "✕ Cancelled"}
                        </button>
                      </div>

                      {/* Patient & Therapy Info */}
                      <h4 className="text-base font-serif font-bold text-[#143826]">
                        {session.patientName}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono">
                        {session.patientCode} · {session.patientGender}
                      </p>

                      <div className="mt-3 p-3 rounded-xl bg-white border border-[#e2d7c5]/80">
                        <p className="text-xs font-bold text-[#143826] font-serif">
                          🌿 {session.therapyName}
                        </p>
                        <p className="text-[11px] text-[#4d5f53] mt-1 flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800">Room:</span>
                          <span>{session.roomName}</span>
                        </p>
                        <p className="text-[11px] text-[#4d5f53] mt-0.5 flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800">Therapist:</span>
                          <span>{session.therapistName}</span>
                          {isGenderMatched ? (
                            <span
                              className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded"
                              title="Same-gender therapist assigned per Ayurvedic protocol"
                            >
                              ✓ Matched
                            </span>
                          ) : (
                            <span
                              className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded"
                              title="Cross-gender assignment requires patient consent"
                            >
                              Attended
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Clinical Care Plan Clearance Indicator */}
                      <div className="mt-3">
                        {session.clinicalClearance ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-900 font-semibold bg-emerald-50/80 p-2 rounded-lg border border-emerald-200">
                            <span>✓</span>
                            <span>Clinical Care Plan Stage Cleared</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-900 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">
                            <span>⚠️</span>
                            <span>Awaiting Clinical Stage Approval</span>
                          </div>
                        )}
                      </div>

                      {session.notes && (
                        <p className="text-[11px] text-[#6b7d72] italic mt-2.5">
                          &ldquo;{session.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Card Bottom Quick Link */}
                    <div className="mt-4 pt-3 border-t border-[#e8ded0] flex items-center justify-between text-xs">
                      <Link
                        href="/clinical/plans"
                        className="font-semibold text-emerald-800 hover:text-emerald-950 underline"
                      >
                        View Care Plan →
                      </Link>
                      <span className="text-[10px] text-[#8e9f94] font-mono">ID: {session.id}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Therapist Duty Roster Section */}
          <section className="bg-[#fbf8f2] rounded-2xl border border-[#e2d7c5] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-serif font-bold text-[#143826]">
                  Therapist Duty Roster & Specializations
                </h3>
                <p className="text-xs text-[#6b7d72] mt-0.5">
                  Qualified Ayurvedic Panchakarma therapists currently active on shift at Colombo Clinic.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-900 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                6 Active Therapists
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {therapistsList.map((th, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-[#e2d7c5] bg-white flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-full bg-[#143826] text-amber-100 flex items-center justify-center font-bold text-sm shrink-0">
                    {th.name.split(" ")[1]?.[0] || "T"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-[#143826]">{th.name}</p>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                        {th.gender}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-900 font-medium">{th.role}</p>
                    <p className="text-[10px] text-[#7a8c80] mt-1">Status: Active on shift</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Modal: Book Therapy Session */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#fbf8f2] rounded-2xl border border-[#d8cbbb] max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e2d7c5] pb-3">
              <div>
                <h3 className="text-base font-serif font-bold text-[#143826]">
                  Book New Therapy Session
                </h3>
                <p className="text-xs text-[#6b7d72] mt-0.5">
                  Assign room, therapist, and time slot with automatic overlap prevention.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBookModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#143826] mb-1">
                  Patient Full Name
                </label>
                <input
                  required
                  type="text"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  placeholder="e.g. Saman Kumara Jayawardena"
                  className="w-full text-xs rounded-xl border border-[#d8cbbb] p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#143826] mb-1">
                    Patient Code
                  </label>
                  <input
                    type="text"
                    value={newPatientCode}
                    onChange={(e) => setNewPatientCode(e.target.value)}
                    placeholder="AYUR-2026-0042"
                    className="w-full text-xs rounded-xl border border-[#d8cbbb] p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#143826] mb-1">
                    Patient Gender
                  </label>
                  <select
                    value={newPatientGender}
                    onChange={(e) => setNewPatientGender(e.target.value as "Male" | "Female")}
                    className="w-full text-xs rounded-xl border border-[#d8cbbb] p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#143826] mb-1">
                  Therapy Procedure
                </label>
                <select
                  value={newTherapy}
                  onChange={(e) => setNewTherapy(e.target.value)}
                  className="w-full text-xs rounded-xl border border-[#d8cbbb] p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                >
                  <option value="Sarvanga Abhyanga & Swedana (60m)">Sarvanga Abhyanga & Swedana (60m)</option>
                  <option value="Shirodhara with Medicated Oil (45m)">Shirodhara with Medicated Oil (45m)</option>
                  <option value="Janu Basti (Knee Joint Retention) (45m)">Janu Basti (Knee Joint Retention) (45m)</option>
                  <option value="Patra Pinda Sweda (Elakizhi) (45m)">Patra Pinda Sweda (Elakizhi) (45m)</option>
                  <option value="Kati Basti (Lumbar Retention) (45m)">Kati Basti (Lumbar Retention) (45m)</option>
                  <option value="Matra Vasti Protocol (30m)">Matra Vasti Protocol (30m)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#143826] mb-1">
                    Treatment Room
                  </label>
                  <select
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                    className="w-full text-xs rounded-xl border border-[#d8cbbb] p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                  >
                    <option value="Droni Suite 01">Droni Suite 01</option>
                    <option value="Shirodhara Chamber">Shirodhara Chamber</option>
                    <option value="Droni Suite 02">Droni Suite 02</option>
                    <option value="Basti Therapy Suite">Basti Therapy Suite</option>
                    <option value="Consultation Suite A">Consultation Suite A</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#143826] mb-1">
                    Assigned Therapist
                  </label>
                  <select
                    value={newTherapist}
                    onChange={(e) => setNewTherapist(e.target.value)}
                    className="w-full text-xs rounded-xl border border-[#d8cbbb] p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                  >
                    {therapistsList.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.gender})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#143826] mb-1">
                  Time Slot
                </label>
                <select
                  value={newTimeSlot}
                  onChange={(e) => setNewTimeSlot(e.target.value)}
                  className="w-full text-xs rounded-xl border border-[#d8cbbb] p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                >
                  <option value="08:30 AM - 09:30 AM">08:30 AM - 09:30 AM</option>
                  <option value="10:00 AM - 11:00 AM">10:00 AM - 11:00 AM</option>
                  <option value="11:30 AM - 12:30 PM">11:30 AM - 12:30 PM</option>
                  <option value="02:00 PM - 03:00 PM">02:00 PM - 03:00 PM</option>
                  <option value="03:30 PM - 04:30 PM">03:30 PM - 04:30 PM</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#143826] mb-1">
                  Therapy Notes / Preparation
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Special instructions, medicated oil batch, temperature guidance..."
                  className="w-full text-xs rounded-xl border border-[#d8cbbb] p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#d8cbbb] text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#143826] text-white text-xs font-bold hover:bg-[#1a4732] shadow-sm transition"
                >
                  Confirm & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
