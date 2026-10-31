"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { APIRequestError } from "@/lib/api-client";
import {
  getPatient,
  getReceptionSession,
  registerPatient,
  searchPatients,
  updatePatient,
  type IdentityType,
  type Patient,
  type PatientChanges,
  type PatientDraft,
} from "./api";
import styles from "./patient-workspace.module.css";

type Access = "checking" | "ready" | "signin" | "forbidden" | "unavailable";
type Notice = { tone: "success" | "error" | "info"; text: string; signIn?: boolean };
type FieldErrors = Partial<Record<"displayName" | "phone" | "identity", string>>;
type FormValues = {
  displayName: string;
  phone: string;
  identityType: IdentityType | "";
  identityValue: string;
};

const emptyForm: FormValues = { displayName: "", phone: "", identityType: "", identityValue: "" };
const byteLength = (value: string) => new TextEncoder().encode(value).length;
const previewPatients: Patient[] = [
  { id: "00000000-0000-4000-8000-000000000101", displayName: "Demo Patient One", phone: "+94 77 000 0101", identity: null, version: 1, createdAt: "2026-10-20T09:00:00Z", updatedAt: "2026-10-20T09:00:00Z" },
  { id: "00000000-0000-4000-8000-000000000102", displayName: "Demo Patient Two", phone: null, identity: { type: "PASSPORT", value: "DEMO-ONLY-02" }, version: 2, createdAt: "2026-10-21T10:30:00Z", updatedAt: "2026-10-22T06:15:00Z" },
];

function formFromPatient(patient: Patient): FormValues {
  return {
    displayName: patient.displayName,
    phone: patient.phone ?? "",
    identityType: patient.identity?.type ?? "",
    identityValue: patient.identity?.value ?? "",
  };
}

function identityFromForm(form: FormValues): Patient["identity"] {
  return form.identityType ? { type: form.identityType, value: form.identityValue.trim() } : null;
}

function validateForm(form: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.displayName.trim()) errors.displayName = "Enter the patient’s name.";
  else if (byteLength(form.displayName) > 512) errors.displayName = "Name is too long.";
  if (byteLength(form.phone) > 64) errors.phone = "Phone is too long.";
  if (form.identityType && !form.identityValue.trim()) errors.identity = "Enter the supplied identity number.";
  else if (!form.identityType && form.identityValue.trim()) errors.identity = "Choose an identity type or clear the number.";
  else if (byteLength(form.identityValue) > 128) errors.identity = "Identity number is too long.";
  return errors;
}

function formatColombo(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo",
  }).format(date);
}

function errorText(error: unknown, action: "search" | "create" | "read" | "update"): string {
  if (error instanceof APIRequestError) {
    if (error.status === 401) return "Your session has ended. Sign in again before continuing.";
    if (error.status === 403 && error.code === "csrf_failed") return "The session security token changed. Try saving again.";
    if (error.status === 403) return "This account cannot access patient demographics.";
    if (error.status === 404) return "This patient record is no longer available to you.";
    if (error.status === 409 && action === "create") return "This identity may already be registered. Search for the patient before trying again.";
    if (error.status === 409 && action === "update") return "This record changed since you opened it. Reload it before editing again.";
    if (error.status === 422) return "Check the patient fields and try again.";
    if (error.status === 503 && action === "create") return "Registration could not be confirmed. Search for this patient before trying again.";
    if (error.status === 503 && action === "update") return "The update could not be confirmed. Reload the record before trying again.";
    if (error.status === 503) return "Patient records are temporarily unavailable. Try again later.";
  }
  if (action === "create") return "Registration could not be confirmed. Search for this patient before trying again.";
  if (action === "update") return "The update could not be confirmed. Reload the record before trying again.";
  return "The request could not be completed. Check your connection and try again.";
}

function requestNotice(error: unknown, action: "search" | "create" | "read" | "update"): Notice {
  return {
    tone: "error",
    text: errorText(error, action),
    signIn: error instanceof APIRequestError && error.status === 401,
  };
}

export default function PatientWorkspace({ preview = false }: { preview?: boolean }) {
  const previewStore = useRef<Patient[]>(previewPatients.map((patient) => ({ ...patient })));
  const [access, setAccess] = useState<Access>(preview ? "ready" : "checking");
  const [query, setQuery] = useState(preview ? "Demo" : "");
  const [searched, setSearched] = useState(preview);
  const [results, setResults] = useState<Patient[]>(preview ? previewPatients : []);
  const [selected, setSelected] = useState<Patient | null>(preview ? previewPatients[0] : null);
  const [panel, setPanel] = useState<"detail" | "register">("detail");
  const [editing, setEditing] = useState(false);
  const [registerForm, setRegisterForm] = useState<FormValues>(emptyForm);
  const [editForm, setEditForm] = useState<FormValues>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preview) return;
    let active = true;
    getReceptionSession().then(
      () => { if (active) setAccess("ready"); },
      (error: unknown) => {
        if (!active) return;
        if (error instanceof APIRequestError && error.status === 401) setAccess("signin");
        else if (error instanceof APIRequestError && error.status === 403) setAccess("forbidden");
        else setAccess("unavailable");
      },
    );
    return () => { active = false; };
  }, [preview]);

  function showRegister() {
    setPanel("register");
    setEditing(false);
    setFieldErrors({});
    setNotice(null);
  }

  function showDetail() {
    setPanel("detail");
    setFieldErrors({});
    setNotice(null);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term || byteLength(term) > 128) {
      setNotice({ tone: "error", text: "Enter a search term of up to 128 bytes." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const items = preview
        ? previewStore.current.filter((patient) => [patient.id, patient.displayName, patient.phone ?? "", patient.identity?.value ?? ""].some((value) => value.toLocaleLowerCase().includes(term.toLocaleLowerCase()))).slice(0, 25)
        : await searchPatients(term);
      setResults(items);
      setSearched(true);
      setSelected(null);
      setPanel("detail");
      setEditing(false);
    } catch (error) {
      setNotice(requestNotice(error, "search"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSelect(id: string) {
    setBusy(true);
    setNotice(null);
    try {
      const patient = preview ? previewStore.current.find((item) => item.id === id) : await getPatient(id);
      if (!patient) throw new APIRequestError(404, "not_found", "Patient not found.");
      setSelected(patient);
      setEditForm(formFromPatient(patient));
      setEditing(false);
      setPanel("detail");
    } catch (error) {
      setNotice(requestNotice(error, "read"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateForm(registerForm);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const input: PatientDraft = {
      displayName: registerForm.displayName.trim(),
      phone: registerForm.phone.trim() || null,
      identity: identityFromForm(registerForm),
    };
    setBusy(true);
    setNotice(null);
    try {
      const patient = preview ? {
        id: crypto.randomUUID(), ...input, version: 1,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      } : await registerPatient(input);
      if (preview) previewStore.current.unshift(patient);
      setSelected(patient);
      setResults([patient]);
      setSearched(false);
      setQuery("");
      setRegisterForm(emptyForm);
      setEditForm(formFromPatient(patient));
      setPanel("detail");
      setNotice({ tone: "success", text: "Patient registered. The record is ready to review." });
    } catch (error) {
      setNotice(requestNotice(error, "create"));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const errors = validateForm(editForm);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const name = editForm.displayName.trim();
    const phone = editForm.phone.trim() || null;
    const identity = identityFromForm(editForm);
    const changes: PatientChanges = { version: selected.version };
    if (name !== selected.displayName) changes.displayName = name;
    if (phone !== selected.phone) changes.phone = phone;
    if (identity?.type !== selected.identity?.type || identity?.value !== selected.identity?.value) {
      changes.identity = identity;
    }
    if (Object.keys(changes).length === 1) {
      setNotice({ tone: "info", text: "No demographic changes to save." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const patient = preview ? {
        ...selected, ...changes, version: selected.version + 1, updatedAt: new Date().toISOString(),
      } : await updatePatient(selected.id, changes);
      if (preview) previewStore.current = previewStore.current.map((item) => item.id === patient.id ? patient : item);
      setSelected(patient);
      setResults((previous) => previous.map((item) => item.id === patient.id ? patient : item));
      setEditForm(formFromPatient(patient));
      setEditing(false);
      setNotice({ tone: "success", text: "Demographic changes saved." });
    } catch (error) {
      setNotice(requestNotice(error, "update"));
    } finally {
      setBusy(false);
    }
  }

  async function reloadSelected() {
    if (!selected) return;
    await handleSelect(selected.id);
  }

  return (
    <div className={styles.workspace}>
      {preview && <div className={styles.previewNotice} role="status"><strong>Synthetic screen preview</strong><span>Try search, registration and edits here. Changes stay in this browser tab and disappear on refresh. No patient API or database is used.</span><Link href="/patients" className={styles.textLink}>Return to live records</Link></div>}
      <div className={styles.headingRow}>
        <div>
          <p className={styles.kicker}>Patient registry</p>
          <h1 className={styles.title}>Patient records</h1>
          <p className={styles.subtitle}>Register a patient, find a record, or correct demographics.</p>
        </div>
        {access === "ready" && (
          <button className={styles.primaryButton} type="button" onClick={showRegister} disabled={busy}>
            Register patient
          </button>
        )}
      </div>

      {access !== "ready" ? (
        <div className={styles.accessPanel} role={access === "checking" ? "status" : "alert"}>
          <h2>{access === "checking" ? "Checking access" : access === "signin" ? "Sign in required" : access === "forbidden" ? "Access unavailable" : "Patient records unavailable"}</h2>
          <p>{access === "checking" ? "Checking your staff session…" : access === "signin" ? "A staff session is required to use patient records." : access === "forbidden" ? "This account does not have reception access to patient demographics." : "The patient service or staff session could not be reached. Try again after it is configured."}</p>
          {access === "signin" && <Link href="/sign-in" className={styles.textLink}>Go to staff sign in</Link>}
          {process.env.NODE_ENV === "development" && access !== "checking" && <p><Link href="/patients/preview" className={styles.textLink}>Preview the patient screens with synthetic data</Link></p>}
        </div>
      ) : (
        <>
          {notice && <div className={`${styles.notice} ${styles[notice.tone]}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}{notice.signIn && <> <Link href="/sign-in" className={styles.textLink}>Staff sign in</Link></>}</div>}
          <div className={styles.columns}>
            <section className={styles.searchPanel} aria-labelledby="patient-search-heading">
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.sectionIndex}>01 / Find</p>
                  <h2 id="patient-search-heading">Find a patient</h2>
                </div>
              </div>
              <form onSubmit={(event) => { void handleSearch(event); }} className={styles.searchForm} role="search">
                <label htmlFor="patient-query" className={styles.label}>Name, ID, identity or phone</label>
                <div className={styles.searchControls}>
                  <input id="patient-query" className={styles.input} value={query} onChange={(event) => setQuery(event.target.value)} disabled={busy} autoComplete="off" />
                  <button className={styles.searchButton} type="submit" disabled={busy}>{busy ? "Working…" : "Search"}</button>
                </div>
                <p className={styles.hint}>Search returns up to 25 permitted records. Refine the term to narrow results.</p>
              </form>
              <div className={styles.results} aria-live="polite">
                {!searched && results.length === 0 ? (
                  <p className={styles.emptyList}>Search to see patient records you may access.</p>
                ) : results.length === 0 ? (
                  <p className={styles.emptyList}>No matching patient records were found.</p>
                ) : (
                  <>
                    <p className={styles.resultCount}>{searched ? `${results.length} result${results.length === 1 ? "" : "s"}` : "Recently registered"}</p>
                    <ul className={styles.resultList}>
                      {results.map((patient) => (
                        <li key={patient.id}>
                          <button type="button" className={styles.resultButton} aria-pressed={selected?.id === patient.id && panel === "detail"} onClick={() => { void handleSelect(patient.id); }} disabled={busy}>
                            <span className={styles.resultName}>{patient.displayName}</span>
                            <span className={styles.resultMeta}>{patient.id}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>

            <section className={styles.recordPanel} aria-labelledby="patient-record-heading">
              {panel === "register" ? (
                <>
                  <div className={styles.sectionHeading}>
                    <div>
                      <p className={styles.sectionIndex}>02 / Register</p>
                      <h2 id="patient-record-heading">New patient</h2>
                    </div>
                    <button className={styles.quietButton} type="button" onClick={showDetail} disabled={busy}>Cancel</button>
                  </div>
                  <p className={styles.panelIntro}>Only a name is required. Record a supplied NIC or passport when available.</p>
                  <form onSubmit={(event) => { void handleRegister(event); }} noValidate>
                    <PatientFields prefix="register" value={registerForm} onChange={setRegisterForm} errors={fieldErrors} disabled={busy} />
                    <div className={styles.formActions}>
                      <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Registering…" : "Register patient"}</button>
                    </div>
                  </form>
                </>
              ) : selected ? (
                <>
                  <div className={styles.sectionHeading}>
                    <div>
                      <p className={styles.sectionIndex}>02 / Record</p>
                      <h2 id="patient-record-heading">{selected.displayName}</h2>
                    </div>
                    {!editing && <button className={styles.secondaryButton} type="button" onClick={() => { setEditForm(formFromPatient(selected)); setFieldErrors({}); setEditing(true); }} disabled={busy}>Edit demographics</button>}
                  </div>
                  {editing ? (
                    <form onSubmit={(event) => { void handleUpdate(event); }} noValidate>
                      <PatientFields prefix="edit" value={editForm} onChange={setEditForm} errors={fieldErrors} disabled={busy} />
                      <p className={styles.hint}>Saving uses record version {selected.version}. A newer edit must be reloaded first.</p>
                      <div className={styles.formActions}>
                        <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
                        <button className={styles.quietButton} type="button" onClick={() => { setEditing(false); setFieldErrors({}); }} disabled={busy}>Cancel</button>
                        <button className={styles.quietButton} type="button" onClick={() => { void reloadSelected(); }} disabled={busy}>Reload record</button>
                      </div>
                    </form>
                  ) : (
                    <dl className={styles.recordDetails}>
                      <div className={styles.detailRow}><dt>Patient ID</dt><dd className={styles.monospace}>{selected.id}</dd></div>
                      <div className={styles.detailRow}><dt>Phone</dt><dd>{selected.phone ?? "Not supplied"}</dd></div>
                      <div className={styles.detailRow}><dt>Identity</dt><dd>{selected.identity ? `${selected.identity.type} · ${selected.identity.value}` : "Not supplied"}</dd></div>
                      <div className={styles.detailRow}><dt>Registered</dt><dd>{formatColombo(selected.createdAt)}</dd></div>
                      <div className={styles.detailRow}><dt>Last updated</dt><dd>{formatColombo(selected.updatedAt)}</dd></div>
                      <div className={styles.detailRow}><dt>Version</dt><dd>{selected.version}</dd></div>
                    </dl>
                  )}
                </>
              ) : (
                <div className={styles.emptyRecord}>
                  <p className={styles.sectionIndex}>02 / Record</p>
                  <h2 id="patient-record-heading">Select a record</h2>
                  <p>Choose a result to view permitted demographics, or register a new patient.</p>
                  <button className={styles.secondaryButton} type="button" onClick={showRegister}>Register patient</button>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function PatientFields({ prefix, value, onChange, errors, disabled }: {
  prefix: string;
  value: FormValues;
  onChange: (value: FormValues) => void;
  errors: FieldErrors;
  disabled: boolean;
}) {
  return (
    <div className={styles.fields}>
      <div className={styles.field}>
        <label htmlFor={`${prefix}-name`} className={styles.label}>Patient name <span aria-hidden="true">*</span></label>
        <input id={`${prefix}-name`} className={styles.input} value={value.displayName} onChange={(event) => onChange({ ...value, displayName: event.target.value })} autoComplete="name" disabled={disabled} required aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? `${prefix}-name-error` : undefined} />
        {errors.displayName && <p className={styles.fieldError} id={`${prefix}-name-error`}>{errors.displayName}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor={`${prefix}-phone`} className={styles.label}>Phone <span className={styles.optional}>Optional</span></label>
        <input id={`${prefix}-phone`} className={styles.input} value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} type="tel" autoComplete="tel" disabled={disabled} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? `${prefix}-phone-error` : undefined} />
        {errors.phone && <p className={styles.fieldError} id={`${prefix}-phone-error`}>{errors.phone}</p>}
      </div>
      <div className={styles.identityFields}>
        <div className={styles.field}>
          <label htmlFor={`${prefix}-identity-type`} className={styles.label}>Identity type <span className={styles.optional}>Optional</span></label>
          <select id={`${prefix}-identity-type`} className={styles.input} value={value.identityType} onChange={(event) => onChange({ ...value, identityType: event.target.value as IdentityType | "", identityValue: event.target.value ? value.identityValue : "" })} disabled={disabled}>
            <option value="">None supplied</option>
            <option value="NIC">NIC</option>
            <option value="PASSPORT">Passport</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${prefix}-identity-value`} className={styles.label}>Identity number</label>
          <input id={`${prefix}-identity-value`} className={styles.input} value={value.identityValue} onChange={(event) => onChange({ ...value, identityValue: event.target.value })} disabled={disabled || !value.identityType} aria-invalid={Boolean(errors.identity)} aria-describedby={errors.identity ? `${prefix}-identity-error` : undefined} />
        </div>
      </div>
      {errors.identity && <p className={styles.fieldError} id={`${prefix}-identity-error`}>{errors.identity}</p>}
      <p className={styles.hint}>Identity is optional. The system checks supplied NIC and passport values for duplicates.</p>
    </div>
  );
}
