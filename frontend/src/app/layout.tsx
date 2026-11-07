import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { MainLayout } from "@/components/main-layout";
import { StaffSessionProvider } from "@/features/administration/session";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | AyurFlow",
    default: "AyurFlow — Living Heritage",
  },
  description: "Ayurvedic clinic staff workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ "--font-inter": "Arial", "--font-serif": "Georgia" } as CSSProperties}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">
          Skip to content
        </a>
        <StaffSessionProvider>
          <MainLayout>{children}</MainLayout>
        </StaffSessionProvider>
      </body>
    </html>
  );
}
