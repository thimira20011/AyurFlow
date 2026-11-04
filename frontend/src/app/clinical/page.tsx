import type { Metadata } from "next";
import { SignedConsultationView } from "@/features/clinical/signed-consultation-view";

export const metadata: Metadata = {
  title: "Signed Clinical Consultation · AyurFlow",
  description: "Living Heritage signed Ayurvedic clinical consultation, Ashtavidha Pariksha, and addenda ledger.",
};

export default function Page() {
  return <SignedConsultationView />;
}
