import type { Metadata } from "next";
import HeritageShell from "@/features/clinical/heritage-shell";
import InventoryReport from "@/features/inventory/inventory-report";

export const metadata: Metadata = { title: "Inventory report | AyurFlow" };

export default function Page() {
  return <HeritageShell section="Reports"><InventoryReport /></HeritageShell>;
}
