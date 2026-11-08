import type { Metadata } from "next";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";

export const metadata: Metadata = {
  title: "Overview",
  description: "A clear view of the clinic day ahead.",
};

export default function DashboardPage() {
  return <DashboardOverview />;
}
