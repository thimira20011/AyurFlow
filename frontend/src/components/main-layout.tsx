"use client";

import React from "react";
export function MainLayout({ children }: { children: React.ReactNode }) {
  return <main id="main" className="min-h-screen w-full">{children}</main>;
}
