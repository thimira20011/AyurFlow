import type { Metadata } from "next";
import PatientWorkspace from "@/features/patients/patient-workspace";

export const metadata: Metadata = {
  title: "Patient Records | AyurFlow",
  description: "Register, search and review permitted patient demographics.",
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ action?: string; search?: string; register?: string }>;
}) {
  const resolved = await searchParams;
  const initialPanel = resolved?.action === "register" || resolved?.register === "true" ? "register" : "detail";
  const initialSearch = resolved?.search ?? "";
  return <PatientWorkspace initialPanel={initialPanel} initialSearch={initialSearch} />;
}
