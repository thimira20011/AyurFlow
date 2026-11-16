"use client";

import React from "react";
export function MainLayout({ children }: { children: React.ReactNode }) {
  return <main id="main" tabIndex={-1} className="min-h-screen w-full">{children}</main>;
}
