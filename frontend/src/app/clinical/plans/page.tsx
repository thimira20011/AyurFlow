import type { Metadata } from "next";
import PlanWorkspace from "@/features/clinical/plan-workspace";
import HeritageShell from "@/features/clinical/heritage-shell";

export const metadata: Metadata = { title: "Care plans | AyurFlow" };

export default async function Page({ searchParams }: { searchParams: Promise<{ patientId?: string | string[] }> }) {
  const candidate = (await searchParams).patientId;
  return <HeritageShell section="Care plans"><PlanWorkspace initialPatientId={typeof candidate === "string" ? candidate : ""} /></HeritageShell>;
}
