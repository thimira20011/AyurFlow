import type { Metadata } from "next";
import PlanWorkspace from "@/features/clinical/plan-workspace";

export const metadata: Metadata = { title: "Care plans | AyurFlow" };

export default async function Page({ searchParams }: { searchParams: Promise<{ patientId?: string | string[] }> }) {
  const candidate = (await searchParams).patientId;
  return <PlanWorkspace initialPatientId={typeof candidate === "string" ? candidate : ""} />;
}
