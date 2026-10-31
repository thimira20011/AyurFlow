import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";


export const metadata: Metadata = {
  title: {
    template: "%s | AyurFlow",
    default: "AyurFlow — Living Heritage",
  },
  description: "Sign in to AyurFlow — Ayurvedic clinic staff workspace",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
