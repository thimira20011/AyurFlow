"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useStaffSession } from "@/features/administration/session";
import { APIRequestError } from "@/lib/api-client";
import {
  addAvailability, bookSession, cancelSession, changeAvailability, completeSession, createRoom, listAvailability,
  listRooms, listSessions, rescheduleSession, startSession,
  type Availability, type Booking, type Room, type Session,
} from "./api";
import styles from "./scheduling-workspace.module.css";

const clinicZone = "Asia/Colombo";
const dateParts = new Intl.DateTimeFormat("en-GB", { timeZone: clinicZone, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: clinicZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function clinicDate(date: Date) {
  const parts = Object.fromEntries(dateParts.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function clinicInput(instant: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: clinicZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const values = Object.fromEntries(parts.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function toUTC(value: string) {
  const parsed = new Date(`${value}:00+05:30`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function errorText(error: unknown) {
  if (error instanceof APIRequestError) {
    if (error.status === 409) return "The slot or clinical clearance changed. Reload the schedule and choose another time.";
    if (error.status === 401) return "Your session ended. Sign in again.";
    if (error.status === 403 || error.status === 404) return "This scheduling record is unavailable to your account.";
    if (error.status === 422) return "Check the required fields and the availability window.";
  }
  return "The scheduling service could not confirm this action. Reload before retrying.";
}

const emptyBooking = { patientId: "", planId: "", stageId: "", roomId: "", therapistId: "", startsAt: "", endsAt: "" };

export default function SchedulingWorkspace() {
  const { session } = useStaffSession();
  const receptionist = session?.roles.includes("receptionist") ?? false;
  const therapist = session?.roles.includes("therapist") ?? false;
  const [date, setDate] = useState(() => clinicDate(new Date()));
  const [rooms, setRooms] = useState<Room[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [resourceType, setResourceType] = useState<"room" | "therapist">("room");
  const [resourceID, setResourceID] = useState("");
  const [availableStart, setAvailableStart] = useState("");
  const [availableEnd, setAvailableEnd] = useState("");
  const [editingAvailability, setEditingAvailability] = useState<Availability | null>(null);
  const [booking, setBooking] = useState(emptyBooking);
  const [editing, setEditing] = useState<Session | null>(null);
  const [observations, setObservations] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    const start = new Date(`${date}T00:00:00+05:30`);
    if (Number.isNaN(start.getTime())) return false;
    setLoading(true);
    try {
      const windowStart = start.toISOString();
      const windowEnd = new Date(start.getTime() + 86_400_000).toISOString();
      const [roomResult, availabilityResult, sessionResult] = await Promise.all([
        listRooms(), listAvailability(windowStart, windowEnd), listSessions(windowStart, windowEnd),
      ]);
      setRooms(roomResult.items ?? []);
      setAvailability(availabilityResult.items ?? []);
      setSessions(sessionResult.items ?? []);
      setNotice("");
      return true;
    } catch (error) { setNoticeError(true); setNotice(errorText(error)); return false; }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { Promise.resolve().then(() => { void load(); }); }, [load]);

  async function perform(action: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice("");
    try {
      await action();
      if (await load()) { setNoticeError(false); setNotice(success); return true; }
      setNoticeError(true); setNotice("The action may have completed, but the updated schedule could not be loaded. Reload before trying again.");
      return false;
    } catch (error) { setNoticeError(true); setNotice(errorText(error)); return false; }
    finally { setBusy(false); }
  }

  function makeWindow(start: string, end: string) {
    const startsAt = toUTC(start), endsAt = toUTC(end);
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
      setNoticeError(true); setNotice("Enter a valid start and end time in Asia/Colombo."); return null;
    }
    return { startsAt, endsAt };
  }

  function submitRoom(event: FormEvent) {
    event.preventDefault();
    void perform(() => createRoom(roomCode, roomName), "Room added.");
  }

  function submitAvailability(event: FormEvent) {
    event.preventDefault();
    const window = makeWindow(availableStart, availableEnd);
    if (!window) return;
    if (editingAvailability) {
      void (async () => {
        if (await perform(() => changeAvailability(editingAvailability.id, window.startsAt, window.endsAt), "Availability changed.")) {
          setEditingAvailability(null); setAvailableStart(""); setAvailableEnd("");
        }
      })();
    } else {
      void perform(() => addAvailability({ roomId: resourceType === "room" ? resourceID : null,
        therapistId: resourceType === "therapist" ? resourceID : null, ...window }), "Availability recorded.");
    }
  }

  function submitBooking(event: FormEvent) {
    event.preventDefault();
    const window = makeWindow(booking.startsAt, booking.endsAt);
    if (!window) return;
    if (editing) {
      void (async () => {
        if (await perform(() => rescheduleSession(editing.id, { roomId: booking.roomId, therapistId: booking.therapistId,
          version: editing.version, ...window }), "Booking moved.")) { setEditing(null); setBooking(emptyBooking); }
      })();
    } else {
      const input: Booking = { ...booking, ...window };
      void (async () => { if (await perform(() => bookSession(input), "Session booked.")) setBooking(emptyBooking); })();
    }
  }

  const therapistIDs = [...new Set(availability.map(item => item.therapistId).filter((id): id is string => Boolean(id)))];
  return <div className={styles.page}>
    <header className={styles.heading}>
      <div><p className={styles.kicker}>ROOMS & THERAPY</p><h1>{receptionist ? "A considered schedule." : "Your assigned sessions."}</h1>
        <p>{receptionist ? "Book only within recorded room and therapist availability. Clinical clearance is rechecked at session start." : "Review your assigned sessions and record delivery after clinical clearance."}</p></div>
      {receptionist && <Link className={styles.linkButton} href="/patients">Find a patient</Link>}
    </header>
    <div className={styles.toolbar}><label htmlFor="schedule-date">Clinic date</label><input id="schedule-date" type="date" value={date} onChange={event => setDate(event.target.value)} />
      <button type="button" onClick={() => void load()} disabled={busy || loading}>Refresh schedule</button><span>Asia/Colombo</span></div>
    {notice && <p className={noticeError ? styles.error : styles.success} role={noticeError ? "alert" : "status"}>{notice}</p>}
    <div className={styles.columns}>
      <section className={styles.panel} aria-labelledby="sessions-title"><div className={styles.panelHead}><h2 id="sessions-title">{receptionist ? "Booked sessions" : "My sessions"}</h2><span>{sessions.length} shown</span></div>
        {loading ? <p role="status">Loading the schedule…</p> : sessions.length === 0 ? <p role="status">No sessions are recorded for this date.</p> : <ul className={styles.sessionList}>{sessions.map(item =>
          <li key={item.id}><div className={styles.sessionTop}><strong>{timeFormat.format(new Date(item.startsAt))} – {timeFormat.format(new Date(item.endsAt))}</strong><span className={styles.badge}>{item.status.replace("_", " ")}</span></div>
            <p>Patient {item.patientId}</p><p>Room {rooms.find(room => room.id === item.roomId)?.name ?? item.roomId}</p>
            {receptionist && <p>Therapist {item.therapistId}</p>}
            {item.observations && <p className={styles.observation}>Delivery observation: {item.observations}</p>}
            {item.cancellationReason && <p>Cancellation reason: {item.cancellationReason}</p>}
            <div className={styles.actions}>
              {receptionist && item.status === "booked" && <button type="button" disabled={busy} onClick={() => { setEditing(item); setBooking({ patientId: item.patientId, planId: item.planId, stageId: item.stageId, roomId: item.roomId, therapistId: item.therapistId, startsAt: clinicInput(item.startsAt), endsAt: clinicInput(item.endsAt) }); }}>Reschedule</button>}
              {therapist && item.status === "booked" && <button type="button" disabled={busy} onClick={() => void perform(() => startSession(item.id), "Session started.")}>Start session</button>}
              {therapist && item.status === "in_progress" && <button type="button" disabled={busy} onClick={() => { setEditing(item); setObservations(""); }}>Record completion</button>}
            </div>
            {receptionist && item.status === "booked" && <form className={styles.inlineForm} onSubmit={event => { event.preventDefault(); void perform(() => cancelSession(item.id, cancelReason), "Booking cancelled."); }}><label htmlFor={`cancel-${item.id}`}>Cancellation reason</label><input id={`cancel-${item.id}`} value={cancelReason} onChange={event => setCancelReason(event.target.value)} required maxLength={1000} /><button disabled={busy}>Cancel booking</button></form>}
            {therapist && editing?.id === item.id && item.status === "in_progress" && <form className={styles.inlineForm} onSubmit={event => { event.preventDefault(); void (async () => { if (await perform(() => completeSession(item.id, observations), "Delivery recorded.")) setEditing(null); })(); }}><label htmlFor={`observations-${item.id}`}>Delivery observations</label><textarea id={`observations-${item.id}`} value={observations} onChange={event => setObservations(event.target.value)} required maxLength={8000} rows={3} /><button disabled={busy}>Complete session</button></form>}
          </li>)}</ul>}
      </section>
      <aside className={styles.side}>
        <section className={styles.panel} aria-labelledby="availability-title"><h2 id="availability-title">Availability</h2>
          <p>Recorded windows for the selected clinic date. A booking needs both room and therapist coverage.</p>
          {availability.length ? <ul className={styles.simpleList}>{availability.map(item => <li key={item.id}><strong>{item.roomId ? rooms.find(room => room.id === item.roomId)?.name ?? "Room" : "Therapist"}</strong><span>{item.therapistId ?? item.roomId}</span><span>{timeFormat.format(new Date(item.startsAt))} – {timeFormat.format(new Date(item.endsAt))}</span>{receptionist && <button type="button" disabled={busy} onClick={() => { setEditingAvailability(item); setResourceType(item.roomId ? "room" : "therapist"); setResourceID(item.roomId ?? item.therapistId ?? ""); setAvailableStart(clinicInput(item.startsAt)); setAvailableEnd(clinicInput(item.endsAt)); }}>Change window</button>}</li>)}</ul> : <p>No availability windows are recorded.</p>}
        </section>
        {receptionist && <><section className={styles.panel} aria-labelledby="booking-title"><h2 id="booking-title">{editing?.status === "booked" ? "Reschedule session" : "Book a session"}</h2><p>Use the patient&apos;s active, approved plan and current stage IDs.</p>
          <form className={styles.form} onSubmit={submitBooking}>
            {(["patientId", "planId", "stageId"] as const).map(key => <label key={key}>{key === "patientId" ? "Patient ID" : key === "planId" ? "Plan ID" : "Stage ID"}<input value={booking[key]} onChange={event => setBooking({ ...booking, [key]: event.target.value })} required disabled={Boolean(editing)} /></label>)}
            <label>Room<select value={booking.roomId} onChange={event => setBooking({ ...booking, roomId: event.target.value })} required><option value="">Choose a room</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
            <label>Therapist<select value={booking.therapistId} onChange={event => setBooking({ ...booking, therapistId: event.target.value })} required><option value="">Choose an available therapist</option>{therapistIDs.map(id => <option key={id} value={id}>{id}</option>)}</select></label>
            <label>Start · Asia/Colombo<input type="datetime-local" value={booking.startsAt} onChange={event => setBooking({ ...booking, startsAt: event.target.value })} required /></label>
            <label>End · Asia/Colombo<input type="datetime-local" value={booking.endsAt} onChange={event => setBooking({ ...booking, endsAt: event.target.value })} required /></label>
            <div className={styles.actions}><button disabled={busy}>{busy ? "Saving…" : editing?.status === "booked" ? "Save new slot" : "Book session"}</button>{editing?.status === "booked" && <button type="button" onClick={() => { setEditing(null); setBooking(emptyBooking); }}>Discard changes</button>}</div>
          </form></section>
          <details className={styles.panel} open={editingAvailability !== null || undefined}><summary>Manage rooms and availability</summary><form className={styles.form} onSubmit={submitRoom}><label>Room code<input value={roomCode} onChange={event => setRoomCode(event.target.value)} required maxLength={64} /></label><label>Room name<input value={roomName} onChange={event => setRoomName(event.target.value)} required maxLength={120} /></label><button disabled={busy}>Add room</button></form>
            <form className={styles.form} onSubmit={submitAvailability}><label>Resource type<select value={resourceType} disabled={Boolean(editingAvailability)} onChange={event => { setResourceType(event.target.value as "room" | "therapist"); setResourceID(""); }}><option value="room">Room</option><option value="therapist">Therapist</option></select></label>
              <label>{resourceType === "room" ? "Room" : "Therapist staff ID"}{resourceType === "room" ? <select value={resourceID} onChange={event => setResourceID(event.target.value)} required disabled={Boolean(editingAvailability)}><option value="">Choose a room</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select> : <input value={resourceID} onChange={event => setResourceID(event.target.value)} required disabled={Boolean(editingAvailability)} />}</label>
              <label>Available from · Asia/Colombo<input type="datetime-local" value={availableStart} onChange={event => setAvailableStart(event.target.value)} required /></label><label>Available until · Asia/Colombo<input type="datetime-local" value={availableEnd} onChange={event => setAvailableEnd(event.target.value)} required /></label><button disabled={busy}>{editingAvailability ? "Save availability change" : "Record availability"}</button>{editingAvailability && <button type="button" onClick={() => { setEditingAvailability(null); setAvailableStart(""); setAvailableEnd(""); }}>Discard change</button>}
            </form></details></>}
      </aside>
    </div>
  </div>;
}
