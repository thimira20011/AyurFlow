import type { Metadata } from "next";
import { CarePlanStageView } from "@/features/clinical/care-plan-stage-view";

export const metadata: Metadata = {
  title: "Care Plan & Stage Approval · AyurFlow",
  description: "Living Heritage Panchakarma care plan, stage clearance pipeline, and clinician decision ledger.",
};

export default function Page() {
  return <CarePlanStageView />;
}
