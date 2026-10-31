"use client";

import React, { useState } from "react";
import Link from "next/link";

interface RoleOption {
  id: string;
  label: string;
  description: string;
}

const ROLES: RoleOption[] = [
  { id: "receptionist", label: "Receptionist", description: "Registration & arrivals" },
  { id: "clinician", label: "Clinician", description: "Consultations & addenda" },
  { id: "therapist", label: "Therapist", description: "Treatment delivery" },
  { id: "dispensary", label: "Dispensary", description: "Herbal batches & stock" },
  { id: "billing", label: "Billing", description: "Invoices & receipts" },
  { id: "administrator", label: "Administrator", description: "Staff & clinic config" },
];

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="heritage-card heritage-card-wide">
      <div className="heritage-card-header">
        <span className="heritage-tag">CONTROLLED STAFF ACCESS</span>
        <h2 className="heritage-title">Request staff access</h2>
        <p className="heritage-subtitle">
          Submit your account details for clinic administrator review and assignment.
        </p>
      </div>

      <form className="heritage-form" id="sign-up-form" onSubmit={handleSubmit} noValidate>
        {/* Name Fields */}
        <div className="heritage-form-row-2">
          <div className="heritage-field-group">
            <label htmlFor="signup-first-name" className="heritage-label">
              First name *
            </label>
            <div className="heritage-input-wrapper">
              <input
                id="signup-first-name"
                name="first_name"
                type="text"
                className="heritage-input"
                autoComplete="given-name"
                placeholder="Amara"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                aria-required="true"
              />
            </div>
          </div>

          <div className="heritage-field-group">
            <label htmlFor="signup-last-name" className="heritage-label">
              Last name *
            </label>
            <div className="heritage-input-wrapper">
              <input
                id="signup-last-name"
                name="last_name"
                type="text"
                className="heritage-input"
                autoComplete="family-name"
                placeholder="Perera"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                aria-required="true"
              />
            </div>
          </div>
        </div>

        {/* Login identifier */}
        <div className="heritage-field-group">
          <label htmlFor="signup-login" className="heritage-label">
            Login identifier *
          </label>
          <div className="heritage-input-wrapper">
            <span className="heritage-input-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </span>
            <input
              id="signup-login"
              name="login"
              type="text"
              className="heritage-input"
              autoComplete="username"
              placeholder="Enter a staff login identifier"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              aria-required="true"
              aria-describedby="signup-login-hint"
            />
          </div>
          <span id="signup-login-hint" className="heritage-field-hint">
            Suggested format: first initial followed by surname (e.g. amara.p)
          </span>
        </div>

        {/* Work email */}
        <div className="heritage-field-group">
          <label htmlFor="signup-email" className="heritage-label">
            Work email address *
          </label>
          <div className="heritage-input-wrapper">
            <span className="heritage-input-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </span>
            <input
              id="signup-email"
              name="email"
              type="email"
              className="heritage-input"
              autoComplete="email"
              placeholder="amara@clinic.lk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
            />
          </div>
        </div>

        {/* Password */}
        <div className="heritage-field-group">
          <label htmlFor="signup-password" className="heritage-label">
            Initial password *
          </label>
          <div className="heritage-input-wrapper">
            <span className="heritage-input-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <input
              id="signup-password"
              name="password"
              type={showPassword ? "text" : "password"}
              className="heritage-input"
              autoComplete="new-password"
              placeholder="At least 10 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
            />
          </div>
        </div>

        {/* Show password checkbox */}
        <div className="heritage-checkbox-row">
          <label className="heritage-checkbox-label" htmlFor="signup-show-password">
            <input
              id="signup-show-password"
              name="show_password"
              type="checkbox"
              className="heritage-checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            <span>Show password</span>
          </label>
        </div>

        {/* Explicit Role Selection (matching Figma Dialog · Create staff account) */}
        <div className="heritage-field-group">
          <div className="heritage-label-row">
            <span className="heritage-label">Assign roles explicitly</span>
            <span className="heritage-label-detail">Select relevant duty</span>
          </div>

          <div className="heritage-role-grid" role="group" aria-label="Staff roles">
            {ROLES.map((role) => {
              const isChecked = selectedRoles.includes(role.id);
              return (
                <label
                  key={role.id}
                  className={`heritage-role-card ${isChecked ? "is-selected" : ""}`}
                  htmlFor={`role-${role.id}`}
                >
                  <input
                    id={`role-${role.id}`}
                    type="checkbox"
                    className="heritage-checkbox"
                    checked={isChecked}
                    onChange={() => toggleRole(role.id)}
                  />
                  <div className="heritage-role-info">
                    <span className="heritage-role-name">{role.label}</span>
                    <span className="heritage-role-desc">{role.description}</span>
                  </div>
                </label>
              );
            })}
          </div>

          <span className="heritage-field-hint">
            Additional report access is granted by report category. Administrator approval required.
          </span>
        </div>

        {/* Notice */}
        <div className="heritage-notice" role="status">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true" className="heritage-notice-icon">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            Staff account requests are reviewed and provisioned by the clinic administrator. Self-service patient accounts are not permitted.
          </span>
        </div>

        {/* Action Buttons: Submit & Cancel */}
        <div className="heritage-button-row">
          <button
            id="signup-submit"
            type="submit"
            className="heritage-btn-primary"
          >
            <span>Submit access request</span>
          </button>

          <Link
            id="signup-cancel"
            href="/sign-in"
            className="heritage-btn-secondary"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Footer Return */}
      <div className="heritage-card-footer">
        <p className="heritage-help-text">
          Already have an account?{" "}
          <Link href="/sign-in" className="heritage-link" id="goto-signin">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
