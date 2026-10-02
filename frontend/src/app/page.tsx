import Link from "next/link";
import { modules } from "@/lib/modules";

export default function HomePage() {
  return (
    <>
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-green-800">Clinic staff workspace</p>
      <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">A connected journey from patient registration to receipt.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
        AyurFlow is being prepared for a single clinic. Explore the planned work areas below.
      </p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <Link key={module.slug} href={`/${module.slug}`} className="rounded-2xl border border-green-900/15 bg-white p-6 transition hover:border-green-700 hover:shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{module.id} · Planned</span>
            <h2 className="mt-4 text-xl font-semibold">{module.title}</h2>
            <p className="mt-3 leading-7 text-slate-600">{module.description}</p>
            <span className="mt-6 block text-sm font-semibold text-green-800">View work area →</span>
          </Link>
        ))}
      </div>
      <p className="mt-10 text-sm text-slate-600">This initial workspace does not yet accept patient records or staff sign-ins.</p>
    </>
  );
}
