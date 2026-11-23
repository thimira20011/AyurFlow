import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { MainLayout } from "@/components/main-layout";
import { SkipLink } from "@/components/skip-link";
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
        <SkipLink />
        <StaffSessionProvider>
          <MainLayout>{children}</MainLayout>
        </StaffSessionProvider>
      </body>
    </html>
  );
}
