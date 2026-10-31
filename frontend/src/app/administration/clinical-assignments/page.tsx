import type { Metadata } from "next";
import AssignmentWorkspace from "@/features/clinical/assignment-workspace";

export const metadata: Metadata = {
  title: "Clinician assignments | AyurFlow",
};

export default function Page() {
  return <AssignmentWorkspace />;
}
