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
  timeSlot: string; // e.g. "09:00 AM - 10:00 AM"
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
  "Consultation Room A",
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

    // Conflict Check: Check if room or therapist is already booked at that time
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
        } is already occupied during ${newTimeSlot} by session for ${conflict.patientName}.\n\nPlease choose a different room, therapist, or time slot.`
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
              href="/clinical/plans"
              className="text-xs font-semibold text-slate-600 hover:text-emerald-900 transition"
            >
              Care Plans
            </Link>
            <span className="text-[#96a79e] text-xs">/</span>
            <span className="text-xs font-bold text-[#143826] bg-emerald-100/70 px-2 py-0.5 rounded">
              Room & Therapist Schedule
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/clinical"
              className="text-xs font-bold px-4 py-2 rounded-xl bg-white text-[#143826] border border-[#143826]/25 hover:bg-emerald-50 shadow-xs transition"
            >
              📋 Consultations →
            </Link>
            <button
              type="button"
              onClick={() => setShowBookModal(true)}
              className="text-xs font-bold px-4 py-2 rounded-xl bg-[#143826] text-white hover:bg-[#1a4732] shadow-sm transition flex items-center gap-1.5"
            >
              <span>+ Book Therapy Session</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Schedule Controls & KPIs Banner */}
        <section className="bg-white rounded-2xl border border-[#2d513e]/15 shadow-sm p-6 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#143826] text-white shadow-xs">
                  Colombo Clinic · Therapy Schedule
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Timezone: Asia/Colombo (UTC+05:30)
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#143826] tracking-tight">
                Treatment Rooms & Therapist Roster
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Real-time room allocation, therapist assignment, and clinical clearance verification.
              </p>
            </div>

            {/* Date Picker & View Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-[#fcfbf7] border border-slate-300 rounded-xl px-3 py-1.5 shadow-xs">
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
                className="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 shadow-sm transition"
              >
                + New Booking
              </button>
            </div>
          </div>

          {/* KPI Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div className="p-3.5 rounded-xl bg-[#fcfbf7] border border-slate-200/80">
              <p className="text-[11px] text-slate-500 font-medium">Total Treatment Rooms</p>
              <p className="text-xl font-serif font-bold text-[#143826]">5 Suites</p>
              <p className="text-[10px] text-emerald-800 mt-0.5">All operating normally</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#fcfbf7] border border-slate-200/80">
              <p className="text-[11px] text-slate-500 font-medium">Active Therapists On Duty</p>
              <p className="text-xl font-serif font-bold text-[#143826]">6 Qualified</p>
              <p className="text-[10px] text-emerald-800 mt-0.5">Gender-matched protocols</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#fcfbf7] border border-slate-200/80">
              <p className="text-[11px] text-slate-500 font-medium">Scheduled Sessions Today</p>
              <p className="text-xl font-serif font-bold text-[#143826]">{sessions.length} Sessions</p>
              <p className="text-[10px] text-slate-600 mt-0.5">Across all therapy types</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#fcfbf7] border border-slate-200/80">
              <p className="text-[11px] text-slate-500 font-medium">Room Overlap Conflicts</p>
              <p className="text-xl font-serif font-bold text-emerald-700">0 Overlaps</p>
              <p className="text-[10px] text-emerald-800 mt-0.5">Conflict prevention verified</p>
            </div>
          </div>
        </section>

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
                  : "bg-white text-slate-700 hover:bg-emerald-50 border border-slate-200"
              }`}
            >
              {room}
            </button>
          ))}
        </div>

        {/* Schedule Matrix / Session Cards Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-serif font-bold text-[#143826] flex items-center gap-2">
              <span>📅</span> Sessions for {selectedDate} ({filteredSessions.length})
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Click status pill to toggle: Scheduled ➔ In Therapy ➔ Completed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSessions.map((session) => {
              const isGenderMatched = session.patientGender === session.therapistGender;

              return (
                <div
                  key={session.id}
                  className={`bg-white rounded-2xl border p-5 flex flex-col justify-between shadow-xs transition hover:shadow-md ${
                    session.status === "in_therapy"
                      ? "border-emerald-600 ring-2 ring-emerald-500/20"
                      : "border-[#2d513e]/15"
                  }`}
                >
                  <div>
                    {/* Top Row: Time Slot & Status Pill */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-bold font-mono text-[#143826] bg-[#fcfbf7] px-2.5 py-1 rounded-lg border border-slate-200">
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
                    <h3 className="text-base font-serif font-bold text-[#143826]">
                      {session.patientName}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {session.patientCode} · {session.patientGender}
                    </p>

                    <div className="mt-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-900/10">
                      <p className="text-xs font-bold text-emerald-950 font-serif">
                        🌿 {session.therapyName}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">Room:</span>
                        <span>{session.roomName}</span>
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1.5">
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
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-900 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
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
                      <p className="text-[11px] text-slate-500 italic mt-2.5">
                        &ldquo;{session.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Card Bottom Quick Link */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <Link
                      href="/clinical/plans"
                      className="font-semibold text-emerald-800 hover:text-emerald-950 underline"
                    >
                      View Care Plan →
                    </Link>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {session.id}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Therapist Duty Roster Section */}
        <section className="bg-white rounded-2xl border border-[#2d513e]/15 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-serif font-bold text-[#143826]">
                Therapist Duty Roster & Specializations
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Qualified Ayurvedic Panchakarma therapists currently on duty at Colombo Clinic.
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
                className="p-4 rounded-xl border border-slate-200 bg-[#fcfbf7] flex items-start gap-3 shadow-xs"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {th.name.split(" ")[1]?.[0] || "T"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-[#143826]">{th.name}</p>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.2 rounded">
                      {th.gender}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-900 font-medium">{th.role}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Status: Active on shift</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Modal: Book Therapy Session */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-green-900/20 max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-serif font-bold text-[#143826]">
                  Book New Therapy Session
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Patient Full Name
                </label>
                <input
                  required
                  type="text"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  placeholder="e.g. Saman Kumara Jayawardena"
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Patient Code
                  </label>
                  <input
                    type="text"
                    value={newPatientCode}
                    onChange={(e) => setNewPatientCode(e.target.value)}
                    placeholder="AYUR-2026-0042"
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Patient Gender
                  </label>
                  <select
                    value={newPatientGender}
                    onChange={(e) => setNewPatientGender(e.target.value as "Male" | "Female")}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Therapy Procedure
                </label>
                <select
                  value={newTherapy}
                  onChange={(e) => setNewTherapy(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Treatment Room
                  </label>
                  <select
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                  >
                    <option value="Droni Suite 01">Droni Suite 01</option>
                    <option value="Shirodhara Chamber">Shirodhara Chamber</option>
                    <option value="Droni Suite 02">Droni Suite 02</option>
                    <option value="Basti Therapy Suite">Basti Therapy Suite</option>
                    <option value="Consultation Room A">Consultation Room A</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Therapist
                  </label>
                  <select
                    value={newTherapist}
                    onChange={(e) => setNewTherapist(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Time Slot
                </label>
                <select
                  value={newTimeSlot}
                  onChange={(e) => setNewTimeSlot(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                >
                  <option value="08:30 AM - 09:30 AM">08:30 AM - 09:30 AM</option>
                  <option value="10:00 AM - 11:00 AM">10:00 AM - 11:00 AM</option>
                  <option value="11:30 AM - 12:30 PM">11:30 AM - 12:30 PM</option>
                  <option value="02:00 PM - 03:00 PM">02:00 PM - 03:00 PM</option>
                  <option value="03:30 PM - 04:30 PM">03:30 PM - 04:30 PM</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Therapy Notes / Preparation
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Special instructions, medicated oil batch, temperature guidance..."
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#143826]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
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
