import type { Metadata } from "next";
import { ReceptionDeskView } from "@/features/reception/reception-desk-view";

export const metadata: Metadata = {
  title: "Reception Desk · AyurFlow",
  description: "AyurFlow Living Heritage Reception Desk workspace",
};

export default function ReceptionPage() {
  return <ReceptionDeskView />;
}

