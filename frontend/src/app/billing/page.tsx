"use client";

import Link from "next/link";
import { BillingWorkspace } from "@/features/billing/billing-workspace";

export default function BillingPage() {
  return (
    <section className="w-full max-w-6xl mx-auto py-4">
      <div className="mb-6">
        <Link href="/workspace" className="text-sm font-semibold text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1">
          ← Back to Clinic Workspace
        </Link>
      </div>

      <BillingWorkspace />
    </section>
  );
}
