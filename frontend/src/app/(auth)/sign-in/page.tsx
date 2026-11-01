import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/features/administration/sign-in-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your AyurFlow clinic staff account",
};

export default function SignInPage() {
  return (
    <div className="heritage-card">
      <div className="heritage-card-header">
        <span className="heritage-tag">YOUR STAFF WORKSPACE</span>
        <h2 className="heritage-title">Welcome back</h2>
        <p className="heritage-subtitle">
          Sign in with the account provided by your administrator.
        </p>
      </div>

      <SignInForm />

      <div className="heritage-card-footer">
        <p className="heritage-help-text">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="heritage-link" id="goto-signup">
            Staff access help
          </Link>
        </p>
      </div>
    </div>
  );
}
