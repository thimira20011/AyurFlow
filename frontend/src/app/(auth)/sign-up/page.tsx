import Link from "next/link";

export default function SignUpPage() {
  return <div className="heritage-card">
    <div className="heritage-card-header">
      <span className="heritage-tag">CONTROLLED STAFF ACCESS</span>
      <h2 className="heritage-title">Staff accounts are administrator-managed</h2>
      <p className="heritage-subtitle">Contact your clinic administrator for an account or password help. Public sign-up and online access requests are unavailable.</p>
    </div>
    <div className="heritage-card-footer">
      <Link href="/sign-in" className="heritage-link">Return to sign in</Link>
    </div>
  </div>;
}
