import { notFound } from "next/navigation";
import WorkspacePreview from "@/features/clinical/heritage/workspace-preview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <WorkspacePreview />;
}
