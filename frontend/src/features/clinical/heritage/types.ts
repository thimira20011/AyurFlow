export interface PatientOverview {
  id: string;
  name: string;
  dosha: string;
  phase: string;
  vitals: ReadonlyArray<{ label: string; value: string }>;
}

export interface TreatmentItem {
  id: string;
  time: string;
  category: "Diet" | "Herbal medicine" | "Therapy";
  title: string;
  instructions: string;
  completed: boolean;
}

export interface ClinicalStage {
  id: string;
  label: string;
  status: "complete" | "review" | "upcoming";
}

export type ReviewDecision = "approved" | "changes_requested";

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
}

export interface SignedConsultation {
  id: string;
  patient: PatientOverview;
  chiefComplaints: string;
  diagnosis: string;
  doctorNotes: string;
  signer: string;
  signedAt: string;
  signatureReference: string;
  verification: "verified" | "unverified" | "demo";
}
