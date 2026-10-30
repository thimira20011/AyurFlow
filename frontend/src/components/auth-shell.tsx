"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSignUp = pathname === "/sign-up";

  return (
    <div className="heritage-auth-shell">
      {/* ── Left Brand Heritage Panel ── */}
      <aside className="heritage-brand-panel" aria-label="AyurFlow Heritage">
        {/* Subtle decorative grain & lighting */}
        <div className="heritage-brand-noise" aria-hidden="true" />
        <div className="heritage-brand-light-1" aria-hidden="true" />
        <div className="heritage-brand-light-2" aria-hidden="true" />

        {/* Top Brand Identity */}
        <div className="heritage-brand-header">
          <Link href="/" className="heritage-brand-logo" aria-label="AyurFlow home">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="heritage-brand-icon"
              aria-hidden="true"
            >
              <path
                d="M16 28C16 28 16 18 16 14"
                stroke="#C5A870"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
              <path
                d="M16 18C10 18 6 13 8 7C14 7 16 12 16 18Z"
                fill="rgba(197, 168, 112, 0.22)"
                stroke="#C5A870"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path
                d="M16 14C22 13 25 8 23 3C18 4 16 9 16 14Z"
                fill="rgba(197, 168, 112, 0.32)"
                stroke="#C5A870"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
            <span className="heritage-brand-title">AyurFlow</span>
          </Link>
          <span className="heritage-brand-badge">Living Heritage</span>
        </div>

        {/* Main Editorial Hero */}
        <div className="heritage-brand-hero">
          <div className="heritage-brand-tag">
            {isSignUp ? "CONTROLLED STAFF ACCESS" : "WELCOME TO AYURFLOW"}
          </div>

          <h1 className="heritage-brand-heading">
            {isSignUp ? (
              <>
                The people<br />
                <span className="heritage-heading-serif">behind the care.</span>
              </>
            ) : (
              <>
                Care, carried<br />
                <span className="heritage-heading-serif">forward.</span>
              </>
            )}
          </h1>

          <p className="heritage-brand-subtext">
            {isSignUp
              ? "Assign only the roles this person needs. Clinical access also requires the appropriate record permissions."
              : "A calm space for the people behind every patient journey."}
          </p>

          {/* Handcrafted Botanical Mortar & Pestle Artwork */}
          <div className="heritage-brand-illustration" aria-hidden="true">
            <svg
              viewBox="0 0 220 230"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="heritage-mortar-svg"
            >
              {/* Botanical branches emerging upwards */}
              <path d="M110 145V36" stroke="#C5A870" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
              <path d="M110 115C92 98 70 94 52 104" stroke="#C5A870" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
              <path d="M110 88C126 73 148 76 160 92" stroke="#C5A870" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
              <path d="M110 65C96 52 82 54 74 66" stroke="#C5A870" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
              
              {/* Budding Ayurvedic Leaves */}
              <path
                d="M110 36C100 22 102 6 110 0C118 6 120 22 110 36Z"
                fill="rgba(197, 168, 112, 0.16)"
                stroke="#C5A870"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M52 104C44 91 48 76 61 74C65 85 61 98 52 104Z"
                fill="rgba(197, 168, 112, 0.16)"
                stroke="#C5A870"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M80 110C70 99 72 85 85 85C90 96 87 106 80 110Z"
                fill="rgba(197, 168, 112, 0.16)"
                stroke="#C5A870"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M160 92C171 79 168 64 155 64C148 75 152 87 160 92Z"
                fill="rgba(197, 168, 112, 0.16)"
                stroke="#C5A870"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M132 82C143 69 140 56 127 56C122 67 125 78 132 82Z"
                fill="rgba(197, 168, 112, 0.16)"
                stroke="#C5A870"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M74 66C66 55 69 43 80 43C84 52 81 61 74 66Z"
                fill="rgba(197, 168, 112, 0.16)"
                stroke="#C5A870"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />

              {/* Classical Mortar Rim */}
              <ellipse cx="110" cy="150" rx="60" ry="15" stroke="#C5A870" strokeWidth="1.75" fill="#1A3B2F" />

              {/* Classical Mortar Vessel Body */}
              <path
                d="M52 152C53 190 77 205 110 205C143 205 167 190 168 152"
                stroke="#C5A870"
                strokeWidth="1.75"
                fill="rgba(197, 168, 112, 0.06)"
              />

              {/* Decorative Etched Bands */}
              <path d="M62 170C78 178 142 178 158 170" stroke="#C5A870" strokeWidth="1" strokeDasharray="3 3" opacity="0.65" />
              <path d="M70 186C84 193 136 193 150 186" stroke="#C5A870" strokeWidth="1" opacity="0.55" />

              {/* Stepped Base / Stand */}
              <path d="M80 205L74 216H146L140 205" stroke="#C5A870" strokeWidth="1.5" fill="rgba(197, 168, 112, 0.08)" />
              <line x1="68" y1="218" x2="152" y2="218" stroke="#C5A870" strokeWidth="2" strokeLinecap="round" />

              {/* Pestle leaning in mortar */}
              <path
                d="M124 153L160 98C164 92 170 91 175 95C180 99 179 105 174 110L138 158"
                stroke="#C5A870"
                strokeWidth="1.75"
                fill="#1E3F30"
              />
            </svg>

            {/* Tradition points on the right of the artwork */}
            <div className="heritage-tradition-group">
              <div className="heritage-tradition-tag">ROOTED IN TRADITION</div>
              <ul className="heritage-tradition-list">
                {isSignUp ? (
                  <>
                    <li>Role-based access.</li>
                    <li>Audited transactions.</li>
                    <li>Protected health records.</li>
                  </>
                ) : (
                  <>
                    <li>Connected records.</li>
                    <li>Considered decisions.</li>
                    <li>Continuity of care.</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Panel Footer */}
        <div className="heritage-brand-footer">
          <span>Single clinic · Staff access only</span>
          <span>AyurFlow © 2026</span>
        </div>
      </aside>

      {/* ── Right Parchment Paper Form Panel ── */}
      <main className="heritage-form-panel" id="main">
        <div className="heritage-parchment-texture" aria-hidden="true" />
        <div className="heritage-form-shell">
          {children}
        </div>
      </main>
    </div>
  );
}
