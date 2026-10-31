"use client";

import Link from "next/link";
import { staffAreas } from "@/lib/api-client";
import { useStaffSession } from "@/features/administration/session";

export default function WorkspacePage() {
  const { session } = useStaffSession();
  const areas = staffAreas.filter(area => area.roles.some(role => session?.roles.includes(role)));
  return <section>
    <h1 className="mb-3 text-3xl font-semibold">Staff workspace</h1>
    <p className="mb-6">Choose an area assigned to your role. Record access is checked by the server.</p>
    {areas.length ? <div className="grid gap-4 sm:grid-cols-2">{areas.map(area => <Link className="rounded-xl border border-green-900/20 bg-white p-6 text-lg font-semibold hover:bg-green-50" href={area.href} key={area.href}>{area.title}</Link>)}</div>
      : <p>No work areas are assigned. Ask an administrator to review your roles.</p>}
  </section>;
}
