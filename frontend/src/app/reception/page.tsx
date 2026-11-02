import type { Metadata } from "next";
import { ReceptionDeskView } from "@/features/reception/reception-desk-view";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Reception Desk · AyurFlow",
  description: "AyurFlow Living Heritage Reception Desk workspace",
};

export default function ReceptionPage() {
  return <>
    <p role="status" className="border-b border-amber-300 bg-amber-50 p-4 text-amber-950">
      Synthetic reception preview. Changes here are not saved. Use <Link href="/patients" className="font-semibold underline">Patient records</Link> for registration and search.
    </p>
    <ReceptionDeskView />
  </>;
}

