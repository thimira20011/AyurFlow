"use client";

import React, { useState } from "react";
import Link from "next/link";

const ROLES = [
  { value: "", label: "Select your role…" },
  { value: "front_desk", label: "Front Desk / Coordinator" },
  { value: "clinician", label: "Clinician" },
  { value: "therapist", label: "Therapist" },
  { value: "dispensary", label: "Dispensary Staff" },
  { value: "cashier", label: "Cashier" },
  { value: "administrator", label: "Administrator" },
] as const;

export function SignUpForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center text-xl font-bold">
          ✓
        </div>
        <h3 className="text-lg font-bold text-white">Access Request Submitted</h3>
        <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
          Your request for <span className="text-emerald-400 font-semibold">{formData.email || "staff account"}</span> has been recorded. The Colombo Clinic Administrator will verify your credentials and activate your access.
        </p>
        <div className="pt-4">
          <Link
            href="/sign-in"
            className="inline-block py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md transition"
          >
            Return to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="auth-form" id="sign-up-form" onSubmit={handleSubmit}>
      <div className="auth-form-row-2">
        <div className="auth-field-group">
          <label htmlFor="signup-first-name" className="auth-label">
            First name
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </span>
            <input
              id="signup-first-name"
              name="first_name"
              type="text"
              className="auth-input"
              autoComplete="given-name"
              placeholder="Amara"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
              aria-required="true"
            />
          </div>
        </div>

        <div className="auth-field-group">
          <label htmlFor="signup-last-name" className="auth-label">
            Last name
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </span>
            <input
              id="signup-last-name"
              name="last_name"
              type="text"
              className="auth-input"
              autoComplete="family-name"
              placeholder="Perera"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
              aria-required="true"
            />
          </div>
        </div>
      </div>

      <div className="auth-field-group">
        <label htmlFor="signup-email" className="auth-label">
          Clinic email
        </label>
        <div className="auth-input-wrapper">
          <span className="auth-input-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
          </span>
          <input
            id="signup-email"
            name="email"
            type="email"
            className="auth-input"
            autoComplete="email"
            placeholder="a.perera@clinic.lk"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            aria-required="true"
          />
        </div>
      </div>

      <div className="auth-field-group">
        <label htmlFor="signup-role" className="auth-label">
          Requested role
        </label>
        <div className="auth-input-wrapper">
          <span className="auth-input-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </span>
          <select
            id="signup-role"
            name="role"
            className="auth-input auth-select"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            required
            aria-required="true"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value} disabled={r.value === ""}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="auth-form-row-2">
        <div className="auth-field-group">
          <label htmlFor="signup-password" className="auth-label">
            Password
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </span>
            <input
              id="signup-password"
              name="password"
              type="password"
              className="auth-input"
              autoComplete="new-password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              aria-required="true"
            />
          </div>
        </div>

        <div className="auth-field-group">
          <label htmlFor="signup-confirm-password" className="auth-label">
            Confirm password
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </span>
            <input
              id="signup-confirm-password"
              name="confirm_password"
              type="password"
              className="auth-input"
              autoComplete="new-password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              aria-required="true"
            />
          </div>
        </div>
      </div>

      <div className="auth-notice" role="status">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true" className="auth-notice-icon">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        Account requests are reviewed and activated by your clinic Administrator.
      </div>

      <button
        id="signup-submit"
        type="submit"
        className="auth-btn-primary cursor-pointer w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-sm transition"
      >
        <span>Submit access request</span>
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </form>
  );
}
