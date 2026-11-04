import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ConsultationWorkspace from "@/features/clinical/consultation-workspace";
import HeritageShell from "@/features/clinical/heritage-shell";

export const metadata: Metadata = {
  title: "Synthetic Consultation Preview | AyurFlow",
  description: "Development-only consultation screen preview.",
};

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <HeritageShell section="Consultations"><ConsultationWorkspace preview /></HeritageShell>;
}
