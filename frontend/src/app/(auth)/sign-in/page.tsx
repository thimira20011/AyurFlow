import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/features/administration/sign-in-form";
import styles from "@/features/administration/heritage.module.css";

export const metadata: Metadata = { title: "Sign In", description: "Sign in to your AyurFlow clinic staff account" };

export default function SignInPage() {
  return <div className={styles.signInCard}>
    <header className={styles.signInHeading}>
      <p className={styles.eyebrow}>YOUR STAFF WORKSPACE</p>
      <h2>Welcome back</h2>
      <p>Sign in with the account provided by your administrator.</p>
    </header>
    <SignInForm />
    <footer className={styles.signInFooter}>
      <p>Need access or help signing in?<br /><Link href="/sign-up">Contact your clinic administrator.</Link></p>
    </footer>
  </div>;
}
