"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function SignInPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="heritage-card">
      <div className="heritage-card-header">
        <span className="heritage-tag">YOUR STAFF WORKSPACE</span>
        <h2 className="heritage-title">Welcome back</h2>
        <p className="heritage-subtitle">
          Sign in with the account provided by your administrator.
        </p>
      </div>

      <form className="heritage-form" id="sign-in-form" onSubmit={handleSubmit} noValidate>
        {/* Login identifier */}
        <div className="heritage-field-group">
          <label htmlFor="signin-login" className="heritage-label">
            Login identifier
          </label>
          <div className="heritage-input-wrapper">
            <span className="heritage-input-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </span>
            <input
              id="signin-login"
              name="login"
              type="text"
              className="heritage-input"
              autoComplete="username"
              placeholder="Enter your login identifier"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              aria-required="true"
            />
          </div>
        </div>

        {/* Password */}
        <div className="heritage-field-group">
          <label htmlFor="signin-password" className="heritage-label">
            Password
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
              id="signin-password"
              name="password"
              type={showPassword ? "text" : "password"}
              className="heritage-input"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
            />
          </div>
        </div>

        {/* Show password checkbox */}
        <div className="heritage-checkbox-row">
          <label className="heritage-checkbox-label" htmlFor="signin-show-password">
            <input
              id="signin-show-password"
              name="show_password"
              type="checkbox"
              className="heritage-checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            <span>Show password</span>
          </label>
        </div>

        {/* Auth configuration note */}
        <div className="heritage-notice" role="status">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true" className="heritage-notice-icon">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            Authentication is being configured. Staff accounts will be available after setup is complete.
          </span>
        </div>

        {/* Sign in button */}
        <button
          id="signin-submit"
          type="submit"
          className="heritage-btn-primary"
        >
          <span>Sign in</span>
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </form>

      {/* Footer assistance & Request access */}
      <div className="heritage-card-footer">
        <p className="heritage-help-text">
          Need access or help signing in?<br />
          Contact your clinic administrator or{" "}
          <Link href="/sign-up" className="heritage-link" id="goto-signup">
            request staff access
          </Link>.
        </p>
      </div>
    </div>
  );
}
