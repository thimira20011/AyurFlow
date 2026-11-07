import { ModulePlaceholder } from "@/components/module-placeholder";
import HeritageShell from "@/features/clinical/heritage-shell";

export default function Page() {
  return <HeritageShell section="Inventory"><ModulePlaceholder slug="inventory" /></HeritageShell>;
}
