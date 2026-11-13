import HeritageShell from "@/features/clinical/heritage-shell";
import InventoryWorkspace from "@/features/inventory/inventory-workspace";

export default function Page() {
  return (
    <HeritageShell section="Inventory">
      <InventoryWorkspace />
    </HeritageShell>
  );
}
