import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PatientWorkspace from "@/features/patients/patient-workspace";
import HeritageShell from "@/features/clinical/heritage-shell";

export const metadata: Metadata = {
  title: "Patient Screen Preview | AyurFlow",
  description: "Synthetic development preview of patient screens.",
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ action?: string; search?: string; register?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const resolved = await searchParams;
  const initialPanel = resolved?.action === "register" || resolved?.register === "true" ? "register" : "detail";
  const initialSearch = resolved?.search ?? "";
  return <HeritageShell section="Patients"><PatientWorkspace preview initialPanel={initialPanel} initialSearch={initialSearch} /></HeritageShell>;
}
