import type { AuditEntry, ClinicalStage, PatientOverview, SignedConsultation, TreatmentItem } from "./types";

// Synthetic examples for interface review; these are not treatment recommendations.
export const patient: PatientOverview = {
  id: "DEMO-PT-001", name: "Demo Patient", dosha: "Vata–Pitta", phase: "Preparatory",
  vitals: [{ label: "Blood pressure", value: "118/76 mmHg" }, { label: "Pulse", value: "72 bpm" }, { label: "Temperature", value: "36.6 °C" }],
};
export const treatmentItems: TreatmentItem[] = [
  { id: "diet", time: "07:00", category: "Diet", title: "Morning meal", instructions: "Follow the clinician-recorded dietary plan.", completed: true },
  { id: "herbs", time: "09:00", category: "Herbal medicine", title: "Prescribed herbal preparation", instructions: "Confirm the recorded prescription and dispensing instructions.", completed: false },
  { id: "therapy", time: "11:30", category: "Therapy", title: "Scheduled therapy session", instructions: "Confirm clinician clearance before the assigned session.", completed: false },
];
export const stages: ClinicalStage[] = [
  { id: "preparatory", label: "Preparatory", status: "review" },
  { id: "primary", label: "Primary", status: "upcoming" },
  { id: "recovery", label: "Recovery", status: "upcoming" },
];
export const auditEntries: AuditEntry[] = [{ id: "created", actor: "Demo clinician", action: "Preparatory stage submitted for review", timestamp: "2026-11-06T03:30:00Z" }];
export const signedDocument: SignedConsultation = {
  id: "DEMO-CON-001", patient, chiefComplaints: "Synthetic follow-up: intermittent digestive discomfort reported by the demo patient.",
  diagnosis: "Illustrative clinician-recorded assessment. This example does not establish a clinical diagnosis.",
  doctorNotes: "Symptoms and relevant history reviewed. Follow-up observations and the agreed care pathway are documented for interface demonstration.",
  signer: "Dr. Demo Clinician", signedAt: "2026-11-06T04:00:00Z", signatureReference: "DEMO-SIGN-001", verification: "demo",
};
