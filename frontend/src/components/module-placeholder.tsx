import Link from "next/link";
import { modules, type ModuleSlug } from "@/lib/modules";

export function ModulePlaceholder({ slug }: { slug: ModuleSlug }) {
  const workArea = modules.find((item) => item.slug === slug)!;
  return (
    <div className="space-y-6">
      {/* Breadcrumb / Back link */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/dashboard" className="font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5 transition">
          <span>←</span> Back to Dashboard
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-600 font-medium">{workArea.title}</span>
      </div>

      <div className="max-w-4xl bg-white border border-green-900/10 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-green-900/10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-900 border border-emerald-200/60">
                {workArea.id}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/60">
                Under Implementation
              </span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-[#183a2d]">
              {workArea.title}
            </h1>
            <p className="mt-2 text-base text-slate-600">
              {workArea.description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-green-900/10 bg-emerald-50/40 p-5 space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-900">
              Active Connected Modules
            </h2>
            <p className="text-sm text-slate-600">
              You can navigate to the fully connected live modules right now:
            </p>
            <div className="pt-2 flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#183a2d] text-white text-xs font-semibold hover:bg-[#23745b] transition shadow-xs"
              >
                📊 Clinic Dashboard
              </Link>
              <Link
                href="/patients"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-green-900/15 text-[#183a2d] text-xs font-semibold hover:bg-emerald-50 transition shadow-xs"
              >
                👥 Patient Records
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Module Development Status
            </h2>
            <p className="text-sm text-slate-600">
              Sprint 1 delivery in progress. Handlers, database schemas, and transactions are being finalized.
            </p>
            <div className="pt-2 text-xs text-slate-500 font-mono">
              Status: In-Review · Asia/Colombo
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
