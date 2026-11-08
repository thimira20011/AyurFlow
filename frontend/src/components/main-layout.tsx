"use client";

import React from "react";
import { usePathname } from "next/navigation";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalonePage =
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname === "/dashboard" ||
    pathname === "/administration" ||
    pathname.startsWith("/reception") ||
    pathname.startsWith("/scheduling") ||
    pathname.startsWith("/clinical");

  if (isStandalonePage) {
    return (
      <main id="main" className="min-h-screen w-full">
        {children}
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
      {children}
    </main>
  );
}
