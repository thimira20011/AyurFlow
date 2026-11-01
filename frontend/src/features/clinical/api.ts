import { apiGet, apiMutation } from "@/lib/api-client";

export type Addendum = {
  id: string;
  consultationId: string;
  authorId: string;
  createdAt: string;
  reason: string;
  body: string;
};

export type Consultation = {
  id: string;
  patientId: string;
  status: "draft" | "signed";
  version: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  draftText?: string;
  signedText?: string;
  signedBy?: string;
  signedAt?: string;
  addenda?: Addendum[];
};

export type ConsultationSummary = Pick<Consultation,
  "id" | "patientId" | "status" | "version" | "createdAt" | "createdBy" | "signedAt">;

export async function listConsultations(patientId: string): Promise<ConsultationSummary[]> {
  const response = await apiGet<{ items: ConsultationSummary[] }>(`/patients/${encodeURIComponent(patientId)}/consultations`);
  return response.items;
}

export function getConsultation(id: string): Promise<Consultation> {
  return apiGet<Consultation>(`/consultations/${encodeURIComponent(id)}`);
}

export function createDraft(patientId: string, draftText: string): Promise<Consultation> {
  return apiMutation<Consultation>(`/patients/${encodeURIComponent(patientId)}/consultations`, { draftText });
}

export function updateDraft(id: string, version: number, draftText: string): Promise<Consultation> {
  return apiMutation<Consultation>(`/consultations/${encodeURIComponent(id)}`, { version, draftText }, "PATCH");
}

export function signDraft(id: string, version: number): Promise<Consultation> {
  return apiMutation<Consultation>(`/consultations/${encodeURIComponent(id)}/sign`, { version });
}

export function addCorrection(id: string, reason: string, body: string): Promise<Addendum> {
  return apiMutation<Addendum>(`/consultations/${encodeURIComponent(id)}/addenda`, { reason, body });
}
