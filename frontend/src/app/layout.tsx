import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AyurFlow",
  description: "Ayurvedic clinic staff workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-3">
          Skip to content
        </a>
        <header className="border-b border-green-900/15 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <Link href="/" className="text-2xl font-semibold tracking-tight">AyurFlow</Link>
            <span className="rounded-full bg-green-50 px-3 py-1 text-sm text-green-900">Initial workspace</span>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-6 py-12">{children}</main>
      </body>
    </html>
  );
}
