import type { Metadata } from "next";
import ConsultationWorkspace from "@/features/clinical/consultation-workspace";

export const metadata: Metadata = {
  title: "Consultations | AyurFlow",
  description: "Review permitted consultation drafts and signed history.",
};

export default async function Page({ searchParams }: {
  searchParams: Promise<{ patientId?: string | string[] }>;
}) {
  const candidate = (await searchParams).patientId;
  return <ConsultationWorkspace initialPatientId={typeof candidate === "string" ? candidate : ""} />;
}
