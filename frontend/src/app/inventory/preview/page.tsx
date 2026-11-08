import type { Metadata } from "next";
import { notFound } from "next/navigation";
import InventoryWorkspace from "@/features/inventory/inventory-workspace";

export const metadata: Metadata = {
  title: "Synthetic Inventory & Preparation Wireframe Preview | AyurFlow",
  description: "Development-only inventory, recipe, preparation and traceability screen preview (TASK-UI-04).",
};

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <InventoryWorkspace preview />;
}
