import type { Metadata } from "next";
import PatientWorkspace from "@/features/patients/patient-workspace";

export const metadata: Metadata = {
  title: "Patient Records | AyurFlow",
  description: "Register, search and review permitted patient demographics.",
};

export default function Page() {
  return <PatientWorkspace />;
}
