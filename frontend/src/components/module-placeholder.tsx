import Link from "next/link";
import { modules, type ModuleSlug } from "@/lib/modules";

export function ModulePlaceholder({ slug }: { slug: ModuleSlug }) {
  const workArea = modules.find((item) => item.slug === slug)!;
  return (
    <section className="max-w-3xl">
      <Link href="/" className="text-sm font-semibold text-green-800">← All work areas</Link>
      <p className="mt-10 text-sm font-semibold uppercase tracking-widest text-slate-500">{workArea.id} · Planned</p>
      <h1 className="mt-3 text-4xl font-semibold">{workArea.title}</h1>
      <p className="mt-5 text-lg leading-8 text-slate-600">{workArea.description}</p>
      <div className="mt-8 rounded-2xl border border-green-900/15 bg-white p-7">
        <h2 className="text-xl font-semibold">This work area is being prepared</h2>
        <p className="mt-3 leading-7 text-slate-600">Staff actions will become available as this part of AyurFlow is completed.</p>
      </div>
    </section>
  );
}
