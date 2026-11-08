import type { Metadata } from "next";
import { ReceptionDeskView } from "@/features/reception/reception-desk-view";
import HeritageShell from "@/features/clinical/heritage-shell";

export const metadata: Metadata = {
  title: "Reception Desk · AyurFlow",
  description: "AyurFlow Living Heritage Reception Desk workspace",
};

export default function ReceptionPage() {
  return <HeritageShell section="Reception"><ReceptionDeskView /></HeritageShell>;
}

