import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PatientWorkspace from "@/features/patients/patient-workspace";

export const metadata: Metadata = {
  title: "Patient Screen Preview | AyurFlow",
  description: "Synthetic development preview of patient screens.",
};

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PatientWorkspace preview />;
}
