"use client";

import { useState } from "react";
import { apiMutation, APIRequestError } from "@/lib/api-client";
import { validPatientId } from "./validation";

export default function AssignmentWorkspace() {
  const [patientId, setPatientId] = useState("");
  const [clinicianId, setClinicianId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function change(action: "grant" | "revoke") {
    if (!validPatientId(patientId) || !validPatientId(clinicianId)) {
      setError("Enter valid patient and clinician UUIDs from the authorized handoff.");
      return;
    }
    if (action === "revoke" && !window.confirm("Revoke this clinician's patient access now?")) return;
    setBusy(true);
    setNotice("");
    setError("");
    const resource = `/patients/${encodeURIComponent(patientId)}/clinical-assignments`;
    try {
      if (action === "grant") {
        await apiMutation<{ id: string }>(resource, { clinicianId });
        setNotice("Clinician assignment granted.");
      } else {
        await apiMutation<void>(`${resource}/${encodeURIComponent(clinicianId)}`, undefined, "DELETE");
        setNotice("Clinician assignment revoked. New clinical requests are denied.");
      }
    } catch (failure) {
      if (failure instanceof APIRequestError) {
        if (failure.status === 409) setError("This clinician already has an active assignment.");
        else if (failure.status === 404) setError("Patient, clinician, or active assignment was not found.");
        else if (failure.status === 403) setError("Only an administrator may manage clinician assignments.");
        else if (failure.status === 401) setError("Your session ended. Sign in again.");
        else setError("The outcome could not be confirmed. Check the assignment before retrying.");
      } else setError("The outcome could not be confirmed. Check the assignment before retrying.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mx-auto max-w-2xl rounded-xl border border-green-900/15 bg-white p-6">
    <h1 className="text-3xl font-semibold">Clinician assignments</h1>
    <p className="my-3">Grant access only after an authorized patient handoff. Assignment permits a clinician to read and edit that patient’s consultations. Administrators cannot read clinical notes through this page.</p>
    <form onSubmit={event => { event.preventDefault(); void change("grant"); }} className="grid gap-4">
      <label className="grid gap-1">Patient internal UUID
        <input className="rounded-lg border p-2" value={patientId} onChange={event => setPatientId(event.target.value.trim())} autoComplete="off" required disabled={busy} />
      </label>
      <label className="grid gap-1">Clinician staff UUID
        <input className="rounded-lg border p-2" value={clinicianId} onChange={event => setClinicianId(event.target.value.trim())} autoComplete="off" required disabled={busy} />
      </label>
      <div className="flex flex-wrap gap-3">
        <button className="rounded-lg bg-emerald-800 px-4 py-2 text-white disabled:opacity-50" disabled={busy}>Grant assignment</button>
        <button type="button" className="rounded-lg border border-red-800 px-4 py-2 text-red-900 disabled:opacity-50" disabled={busy} onClick={() => { void change("revoke"); }}>Revoke assignment</button>
      </div>
    </form>
    {notice && <p role="status" className="mt-4">{notice}</p>}
    {error && <p role="alert" className="mt-4 text-red-900">{error}</p>}
  </section>;
}
