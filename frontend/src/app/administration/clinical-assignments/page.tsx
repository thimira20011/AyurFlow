import type { Metadata } from "next";
import AssignmentWorkspace from "@/features/clinical/assignment-workspace";
import HeritageShell from "@/features/clinical/heritage-shell";

export const metadata: Metadata = {
  title: "Clinician assignments | AyurFlow",
};

export default function Page() {
  return <HeritageShell section="Administration"><AssignmentWorkspace /></HeritageShell>;
}
