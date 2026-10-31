"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navTabs = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Patient Records", href: "/patients" },
  { name: "Clinical Pathway", href: "/clinical" },
  { name: "Scheduling", href: "/scheduling" },
  { name: "Dispensary", href: "/inventory" },
  { name: "Invoices & Receipts", href: "/billing" },
  { name: "Administration", href: "/administration" },
];

export function Navbar() {
  const pathname = usePathname();

  // On auth pages, don't display the clinic navbar
  if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/" || pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="border-b border-green-900/15 bg-white sticky top-0 z-40 backdrop-blur-md bg-white/95 shadow-xs">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-3.5">
        {/* Brand & Clinic Branch */}
        <div className="flex items-center justify-between w-full lg:w-auto gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-2xl font-bold tracking-tight text-[#183a2d] font-sans flex items-center gap-2.5 hover:opacity-90 transition">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#23745b] to-[#10b981] flex items-center justify-center text-white text-sm font-bold shadow-xs">
                🌿
              </span>
              <span>AyurFlow</span>
            </Link>
            <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
              Colombo Clinic
            </span>
          </div>

          {/* Mobile staff badge */}
          <Link
            href="/sign-in"
            className="lg:hidden text-xs font-medium text-slate-500 hover:text-emerald-800 flex items-center gap-1.5"
            title="Sign out"
          >
            <span>Exit</span>
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>

        {/* ── Module Navigation Tabs ── */}
        <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-none justify-between lg:justify-end">
          <nav className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold">
            {navTabs.map((tab) => {
              const active = isActive(tab.href);
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                    active
                      ? "bg-[#183a2d] text-white shadow-xs font-bold"
                      : "bg-white text-slate-700 hover:text-emerald-900 hover:bg-emerald-50/70 border border-green-900/10 shadow-xs"
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Staff / Sign out indicator */}
          <div className="hidden lg:flex items-center pl-2 border-l border-green-900/10">
            <Link
              href="/sign-in"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50/60 transition"
              title="Sign out of current staff session"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Sign out</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
