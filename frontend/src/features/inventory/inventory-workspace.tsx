"use client";

import React, { useState } from "react";
import styles from "./inventory-workspace.module.css";

type Eligibility = "eligible" | "blocked" | "expired" | "unknown_expiry";

interface SyntheticBatch {
  id: string;
  itemCode: string;
  itemName: string;
  batchReference: string;
  receivedGrams: string;
  remainingGrams: string;
  expiresAt: string | null;
  blocked: boolean;
  blockReason: string | null;
  eligibility: Eligibility;
}

interface SnapshotIngredient {
  itemCode: string;
  itemName: string;
  baseGrams: string;
  requiredGrams: string;
}

const INITIAL_BATCHES: SyntheticBatch[] = [
  {
    id: "d-batch-ashwa-a",
    itemCode: "BOT-ASHWA-001",
    itemName: "Ashwagandha Root (Withania somnifera)",
    batchReference: "CLN-BATCH-2026-A01",
    receivedGrams: "1000.000",
    remainingGrams: "1000.000",
    expiresAt: "2027-06-30",
    blocked: false,
    blockReason: null,
    eligibility: "eligible",
  },
  {
    id: "d-batch-ashwa-b",
    itemCode: "BOT-ASHWA-001",
    itemName: "Ashwagandha Root (Withania somnifera)",
    batchReference: "CLN-BATCH-2026-A02",
    receivedGrams: "500.000",
    remainingGrams: "500.000",
    expiresAt: "2027-09-15",
    blocked: false,
    blockReason: null,
    eligibility: "eligible",
  },
  {
    id: "d-batch-guduchi-a",
    itemCode: "BOT-GUDU-002",
    itemName: "Guduchi Stem (Tinospora cordifolia)",
    batchReference: "CLN-BATCH-2026-G01",
    receivedGrams: "400.000",
    remainingGrams: "400.000",
    expiresAt: "2027-08-01",
    blocked: false,
    blockReason: null,
    eligibility: "eligible",
  },
  {
    id: "d-batch-ashwa-blocked",
    itemCode: "BOT-ASHWA-001",
    itemName: "Ashwagandha Root (Withania somnifera)",
    batchReference: "CLN-BATCH-2026-A03-BLK",
    receivedGrams: "300.000",
    remainingGrams: "300.000",
    expiresAt: "2027-12-31",
    blocked: true,
    blockReason: "Packaging seal damaged during transit",
    eligibility: "blocked",
  },
  {
    id: "d-batch-ashwa-expired",
    itemCode: "BOT-ASHWA-001",
    itemName: "Ashwagandha Root (Withania somnifera)",
    batchReference: "CLN-BATCH-2025-A99-EXP",
    receivedGrams: "250.000",
    remainingGrams: "250.000",
    expiresAt: "2025-12-31",
    blocked: false,
    blockReason: null,
    eligibility: "expired",
  },
  {
    id: "d-batch-ashwa-unknown-expiry",
    itemCode: "BOT-ASHWA-001",
    itemName: "Ashwagandha Root (Withania somnifera)",
    batchReference: "CLN-BATCH-2026-A04-UNK",
    receivedGrams: "200.000",
    remainingGrams: "200.000",
    expiresAt: null,
    blocked: false,
    blockReason: null,
    eligibility: "unknown_expiry",
  },
];

function parseMilligrams(grams: string): number | null {
  const trimmed = grams.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const paddedFrac = (frac + "000").slice(0, 3);
  const mg = Number(whole) * 1000 + Number(paddedFrac);
  if (!Number.isSafeInteger(mg) || mg <= 0) return null;
  return mg;
}

function formatMilligrams(mg: number): string {
  const sign = mg < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(mg));
  const whole = Math.floor(abs / 1000);
  const frac = (abs % 1000).toString().padStart(3, "0");
  return `${sign}${whole.toString()}.${frac}`;
}

function scaleRoundHalfUp(baseMg: number, targetMg: number, baseYieldMg: number): number {
  const numerator = baseMg * targetMg * 2 + baseYieldMg;
  return Math.floor(numerator / (baseYieldMg * 2));
}

export default function InventoryWorkspace({ preview = false }: { preview?: boolean }) {
  const [activeTab, setActiveTab] = useState<"batches" | "recipes" | "consumption" | "traceability">("batches");
  const [batches, setBatches] = useState<SyntheticBatch[]>(INITIAL_BATCHES);
  const [blockTargetId, setBlockTargetId] = useState<string>("d-batch-ashwa-b");
  const [blockReason, setBlockReason] = useState<string>("Quality inspection hold — moisture check");
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  // Recipe & Preparation Snapshot state
  const [selectedRecipe, setSelectedRecipe] = useState<"balashwagandha" | "bala">("balashwagandha");
  const [targetYieldInput, setTargetYieldInput] = useState<string>("250.000");
  const [savedSnapshot, setSavedSnapshot] = useState<{
    id: string;
    patientId: string;
    patientName: string;
    sessionId: string;
    recipeName: string;
    baseYieldGrams: string;
    targetYieldGrams: string;
    status: "prepared" | "consumed";
    operationId: string;
    confirmedAt: string | null;
    ingredients: SnapshotIngredient[];
  }>({
    id: "d-prep-srs-scale",
    patientId: "b-no-identity",
    patientName: "Synthetic Patient No ID",
    sessionId: "c-session-01",
    recipeName: "REC-ASHWA-GUDU-01 · Synthetic Ashwagandha-Guduchi Decoction Mix",
    baseYieldGrams: "100.000",
    targetYieldGrams: "250.000",
    status: "prepared",
    operationId: "7c4a1b9e-2001-4c9a-8a11-111111111111",
    confirmedAt: null,
    ingredients: [
      {
        itemCode: "BOT-ASHWA-001",
        itemName: "Ashwagandha Root (Withania somnifera)",
        baseGrams: "20.000",
        requiredGrams: "50.000",
      },
      {
        itemCode: "BOT-GUDU-002",
        itemName: "Guduchi Stem (Tinospora cordifolia)",
        baseGrams: "15.000",
        requiredGrams: "37.500",
      },
    ],
  });

  // Manual batch allocation inputs for d-prep-srs-scale
  const [allocAshwaA, setAllocAshwaA] = useState<string>("30.000");
  const [allocAshwaB, setAllocAshwaB] = useState<string>("20.000");
  const [allocGuduA, setAllocGuduA] = useState<string>("37.500");
  const [consumptionNotice, setConsumptionNotice] = useState<{ type: "info" | "error"; text: string } | null>(null);

  const baseYieldMg = selectedRecipe === "balashwagandha" ? 100000 : 300000;
  const parsedTargetMg = parseMilligrams(targetYieldInput);

  const liveScaledIngredients: SnapshotIngredient[] =
    selectedRecipe === "balashwagandha"
      ? [
          {
            itemCode: "BOT-ASHWA-001",
            itemName: "Ashwagandha Root (Withania somnifera)",
            baseGrams: "20.000",
            requiredGrams: parsedTargetMg ? formatMilligrams(scaleRoundHalfUp(20000, parsedTargetMg, baseYieldMg)) : "—",
          },
          {
            itemCode: "BOT-GUDU-002",
            itemName: "Guduchi Stem (Tinospora cordifolia)",
            baseGrams: "15.000",
            requiredGrams: parsedTargetMg ? formatMilligrams(scaleRoundHalfUp(15000, parsedTargetMg, baseYieldMg)) : "—",
          },
        ]
      : [
          {
            itemCode: "BOT-BALA-003",
            itemName: "Bala Root (Sida cordifolia)",
            baseGrams: "10.000",
            requiredGrams: parsedTargetMg ? formatMilligrams(scaleRoundHalfUp(10000, parsedTargetMg, baseYieldMg)) : "—",
          },
        ];

  const handleBlockBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockReason.trim()) {
      setBatchMessage("Error (422): A nonblank block reason is required for the audit record.");
      return;
    }
    setBatches((prev) =>
      prev.map((b) =>
        b.id === blockTargetId
          ? { ...b, blocked: true, blockReason: blockReason.trim(), eligibility: "blocked" }
          : b
      )
    );
    setBatchMessage(`Batch ${blockTargetId} blocked with audited reason: "${blockReason.trim()}".`);
  };

  const handleSaveSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedTargetMg) return;
    setSavedSnapshot({
      id: selectedRecipe === "balashwagandha" ? "d-prep-srs-scale" : "d-prep-rounding-scale",
      patientId: "b-no-identity",
      patientName: "Synthetic Patient No ID",
      sessionId: "c-session-01",
      recipeName:
        selectedRecipe === "balashwagandha"
          ? "REC-ASHWA-GUDU-01 · Synthetic Ashwagandha-Guduchi Decoction Mix"
          : "REC-BALA-02 · Synthetic Three-Part Bala Blend",
      baseYieldGrams: formatMilligrams(baseYieldMg),
      targetYieldGrams: formatMilligrams(parsedTargetMg),
      status: "prepared",
      operationId: "7c4a1b9e-2001-4c9a-8a11-111111111111",
      confirmedAt: null,
      ingredients: liveScaledIngredients,
    });
    setConsumptionNotice({
      type: "info",
      text: "Saved immutable preparation snapshot (status: Prepared · No Stock Deducted). Batch balances remain untouched.",
    });
    setActiveTab("consumption");
  };

  const ashwaAMg = parseMilligrams(allocAshwaA) ?? 0;
  const ashwaBMg = parseMilligrams(allocAshwaB) ?? 0;
  const guduAMg = parseMilligrams(allocGuduA) ?? 0;
  const ashwaSumMg = ashwaAMg + ashwaBMg;

  const handleConfirmConsumption = () => {
    if (savedSnapshot.status === "consumed") {
      setConsumptionNotice({
        type: "info",
        text: `Idempotent retry (${savedSnapshot.operationId}): Returning original confirmed consumption with zero additional deduction.`,
      });
      return;
    }
    const batchB = batches.find((b) => b.id === "d-batch-ashwa-b");
    if (batchB && batchB.eligibility !== "eligible" && ashwaBMg > 0) {
      setConsumptionNotice({
        type: "error",
        text: `409 Conflict (INV-02 / PRE-05): Selected batch ${batchB.batchReference} is ${batchB.eligibility} ("${batchB.blockReason ?? "ineligible"}"). Entire transaction rolled back; zero stock deducted.`,
      });
      return;
    }
    if (ashwaSumMg !== 50000 || guduAMg !== 37500) {
      setConsumptionNotice({
        type: "error",
        text: `422 Unprocessable Entity (PRE-04): Allocated batch quantities (${formatMilligrams(ashwaSumMg)} g Ashwagandha, ${formatMilligrams(guduAMg)} g Guduchi) must equal the saved snapshot (50.000 g and 37.500 g).`,
      });
      return;
    }
    setBatches((prev) =>
      prev.map((b) => {
        if (b.id === "d-batch-ashwa-a") {
          const rem = (parseMilligrams(b.remainingGrams) ?? 1000000) - ashwaAMg;
          return { ...b, remainingGrams: formatMilligrams(rem) };
        }
        if (b.id === "d-batch-ashwa-b") {
          const rem = (parseMilligrams(b.remainingGrams) ?? 500000) - ashwaBMg;
          return { ...b, remainingGrams: formatMilligrams(rem) };
        }
        if (b.id === "d-batch-guduchi-a") {
          const rem = (parseMilligrams(b.remainingGrams) ?? 400000) - guduAMg;
          return { ...b, remainingGrams: formatMilligrams(rem) };
        }
        return b;
      })
    );
    setSavedSnapshot((prev) => ({
      ...prev,
      status: "consumed",
      confirmedAt: "01 Nov 2026, 20:15 · Asia/Colombo",
    }));
    setConsumptionNotice({
      type: "info",
      text: "200 OK (PRE-04): Locked batches in batch_id ASC order, verified eligibility, deducted stock, recorded batch_consumptions, and wrote preparation.consumed audit event in one transaction.",
    });
  };

  return (
    <div className={styles.workspace}>
      {preview && (
        <div className={styles.previewBanner} role="status">
          <span className={styles.previewTag}>TASK-UI-04 Wireframe Preview</span>
          <span>
            Development-only interactive wireframe using synthetic fixtures (<code>member-d-synthetic-v1</code>). No protected API routes or real patient records are connected.
          </span>
        </div>
      )}

      <header className={styles.headerArea}>
        <p className={styles.kicker}>Dispensary &amp; Botanical Inventory · Member D (SRS INV-01–04, PRE-01–06)</p>
        <div className={styles.headingRow}>
          <div>
            <h1 className={styles.title}>Botanical Batches, Flat Recipes &amp; Traceability</h1>
            <p className={styles.subtitle}>
              Fixed-precision grams (<code>0.001 g</code>), immutable preparation snapshots, manual batch selection, and atomic consumption.
            </p>
          </div>
          <div>
            <span className={savedSnapshot.status === "consumed" ? styles.badgeConsumed : styles.badgePrepared}>
              Active Prep {savedSnapshot.id}:{" "}
              {savedSnapshot.status === "consumed"
                ? "Consumed · Stock Deducted (Immutable)"
                : "Prepared · No Stock Deducted"}
            </span>
          </div>
        </div>
      </header>

      <section className={styles.statsGrid} aria-label="Inventory summary metrics">
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Consumable Stock (Eligible)</div>
          <div className={styles.statValue}>
            {formatMilligrams(
              batches
                .filter((b) => b.eligibility === "eligible")
                .reduce((acc, b) => acc + (parseMilligrams(b.remainingGrams) ?? 0), 0)
            )}{" "}
            g
          </div>
          <div className={styles.statSub}>Excludes blocked, expired &amp; unknown-expiry batches</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Blocked Stock (Excluded)</div>
          <div className={styles.statValue}>
            {formatMilligrams(
              batches
                .filter((b) => b.eligibility === "blocked")
                .reduce((acc, b) => acc + (parseMilligrams(b.remainingGrams) ?? 0), 0)
            )}{" "}
            g
          </div>
          <div className={styles.statSub}>Requires audited block reason (INV-02)</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Expired Stock (Excluded)</div>
          <div className={styles.statValue}>250.000 g</div>
          <div className={styles.statSub}>Evaluated against Asia/Colombo date</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Unknown Expiry (SRS §8 Gate)</div>
          <div className={styles.statValue}>200.000 g</div>
          <div className={styles.statSub}>Not consumable until DEC03 policy / date verified</div>
        </div>
      </section>

      <nav className={styles.tabsRow} aria-label="Dispensary workflow screens">
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "batches" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("batches")}
        >
          01 · Items &amp; Stock Batches (AT08)
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "recipes" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("recipes")}
        >
          02 · Flat Recipes &amp; Snapshot (AT09)
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "consumption" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("consumption")}
        >
          03 · Prepared vs. Consumed (AT10)
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "traceability" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("traceability")}
        >
          04 · Bidirectional Traceability &amp; Reports (AT11)
        </button>
      </nav>

      {activeTab === "batches" && (
        <div className={styles.splitGrid}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Block Batch / Eligibility Check</h2>
            </div>
            <form onSubmit={handleBlockBatch}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="block-batch-select">
                  Select active batch to block (INV-02)
                </label>
                <select
                  id="block-batch-select"
                  className={styles.select}
                  value={blockTargetId}
                  onChange={(e) => setBlockTargetId(e.target.value)}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchReference} · {b.itemName} ({b.eligibility})
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="block-reason-input">
                  Mandatory block reason (transactional audit event)
                </label>
                <input
                  id="block-reason-input"
                  className={styles.input}
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                />
                <p className={styles.hint}>
                  Blocking a batch immediately prevents consumption confirmation even if a preparation screen was already open.
                </p>
              </div>
              <div className={styles.actions}>
                <button type="submit" className={styles.dangerBtn}>
                  Block Selected Batch
                </button>
              </div>
            </form>
            {batchMessage && <div className={styles.calloutInfo}>{batchMessage}</div>}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Botanical Batch Registry (Manual Selection View)</h2>
              <span className={styles.hint}>No automatic FEFO or stock reservation (INV-03)</span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Batch Ref &amp; Botanical Item</th>
                    <th>Received</th>
                    <th>Remaining</th>
                    <th>Expiry (Colombo)</th>
                    <th>Eligibility Badge</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td>
                        <strong className={styles.mono}>{batch.batchReference}</strong>
                        <div className={styles.hint}>
                          {batch.itemCode} · {batch.itemName}
                        </div>
                        {batch.blockReason && (
                          <div className={styles.hint}>Block reason: {batch.blockReason}</div>
                        )}
                      </td>
                      <td className={styles.mono}>{batch.receivedGrams} g</td>
                      <td className={styles.mono}>
                        <strong>{batch.remainingGrams} g</strong>
                      </td>
                      <td className={styles.mono}>{batch.expiresAt ?? "None supplied"}</td>
                      <td>
                        {batch.eligibility === "eligible" && (
                          <span className={styles.badgeEligible}>Eligible</span>
                        )}
                        {batch.eligibility === "blocked" && (
                          <span className={styles.badgeBlocked}>Blocked · Ineligible</span>
                        )}
                        {batch.eligibility === "expired" && (
                          <span className={styles.badgeBlocked}>Expired · Ineligible</span>
                        )}
                        {batch.eligibility === "unknown_expiry" && (
                          <span className={styles.badgeUnknown}>Unknown Expiry · Not Consumable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "recipes" && (
        <div className={styles.splitGrid}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>1. Select Flat Recipe (PRE-01)</h2>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="recipe-select">
                Flat botanical recipe (no nested recipes)
              </label>
              <select
                id="recipe-select"
                className={styles.select}
                value={selectedRecipe}
                onChange={(e) => {
                  const next = e.target.value as "balashwagandha" | "bala";
                  setSelectedRecipe(next);
                  setTargetYieldInput(next === "balashwagandha" ? "250.000" : "100.000");
                }}
              >
                <option value="balashwagandha">
                  REC-ASHWA-GUDU-01 · Ashwagandha-Guduchi Mix (Base yield: 100.000 g)
                </option>
                <option value="bala">
                  REC-BALA-02 · Three-Part Bala Blend (Base yield: 300.000 g — Rounding test)
                </option>
              </select>
            </div>
            <div className={styles.calloutInfo}>
              <strong>SRS AT09 Scaling Rule:</strong> Each ingredient is scaled as{" "}
              <code>base_grams × target_yield ÷ base_yield</code> using fixed-precision Round Half Up to{" "}
              <code>0.001 g</code>. Later edits to the recipe will never alter an already saved preparation snapshot.
            </div>
          </div>

          <div className={styles.panelPrepared}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>2. Scale &amp; Save Preparation Snapshot (PRE-02–03)</h2>
                <p className={styles.hint}>
                  Patient: Synthetic Patient No ID (<code>b-no-identity</code>) · Session: <code>c-session-01</code> (minimum identifiers only; no clinical notes)
                </p>
              </div>
              <span className={styles.badgePrepared}>Saves as: Prepared · No Stock Deducted</span>
            </div>

            <form onSubmit={handleSaveSnapshot}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="target-yield-input">
                  Target yield in grams (positive, up to 3 decimal places)
                </label>
                <input
                  id="target-yield-input"
                  className={`${styles.input} ${styles.mono}`}
                  type="text"
                  value={targetYieldInput}
                  onChange={(e) => setTargetYieldInput(e.target.value)}
                />
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Botanical Ingredient</th>
                      <th>Base Quantity</th>
                      <th>Scaled Snapshot Requirement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveScaledIngredients.map((ing) => (
                      <tr key={ing.itemCode}>
                        <td>
                          <strong>{ing.itemName}</strong>
                          <div className={styles.hint}>{ing.itemCode}</div>
                        </td>
                        <td className={styles.mono}>{ing.baseGrams} g</td>
                        <td className={styles.mono}>
                          <strong>{ing.requiredGrams} g</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.calloutWarn}>
                <strong>PRE-03 No-Deduction Guarantee:</strong> Saving this preparation records the scaled ingredient snapshot only. It does <strong>not</strong> reserve or deduct any batch stock.
              </div>

              <div className={styles.actions}>
                <button type="submit" className={styles.primaryBtn} disabled={!parsedTargetMg}>
                  Save Immutable Preparation Snapshot (0.000 g Deducted)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "consumption" && (
        <div className={styles.equalGrid}>
          {/* LEFT: PREPARED / MANUAL BATCH ALLOCATION */}
          <div className={styles.panelPrepared}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>State A · Saved Preparation (Awaiting Confirmation)</h2>
                <p className={styles.hint}>
                  Prep ID: <code>{savedSnapshot.id}</code> · Operation ID: <code>{savedSnapshot.operationId}</code>
                </p>
              </div>
              <span className={styles.badgePrepared}>Prepared · No Stock Deducted</span>
            </div>

            <div className={styles.calloutWarn}>
              <strong>Manual Batch Selection (INV-03 &amp; PRE-04):</strong> Staff manually allocate eligible batches below so each ingredient sums to its saved snapshot quantity. At confirmation, batches are locked in ascending <code>batch_id</code> order and rechecked for eligibility and sufficiency.
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="alloc-ashwa-a">
                Ashwagandha Root (Required snapshot: <code>50.000 g</code>) — Batch{" "}
                <code>CLN-BATCH-2026-A01</code> (Eligible)
              </label>
              <input
                id="alloc-ashwa-a"
                className={`${styles.input} ${styles.mono}`}
                type="text"
                value={allocAshwaA}
                onChange={(e) => setAllocAshwaA(e.target.value)}
                disabled={savedSnapshot.status === "consumed"}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="alloc-ashwa-b">
                Ashwagandha Root — Second Batch <code>CLN-BATCH-2026-A02</code> (Status:{" "}
                {batches.find((b) => b.id === "d-batch-ashwa-b")?.eligibility})
              </label>
              <input
                id="alloc-ashwa-b"
                className={`${styles.input} ${styles.mono}`}
                type="text"
                value={allocAshwaB}
                onChange={(e) => setAllocAshwaB(e.target.value)}
                disabled={savedSnapshot.status === "consumed"}
              />
              <p className={styles.hint}>
                Ashwagandha allocated sum: <code>{formatMilligrams(ashwaSumMg)} g</code> / <code>50.000 g</code> required
              </p>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="alloc-gudu-a">
                Guduchi Stem (Required snapshot: <code>37.500 g</code>) — Batch{" "}
                <code>CLN-BATCH-2026-G01</code> (Eligible)
              </label>
              <input
                id="alloc-gudu-a"
                className={`${styles.input} ${styles.mono}`}
                type="text"
                value={allocGuduA}
                onChange={(e) => setAllocGuduA(e.target.value)}
                disabled={savedSnapshot.status === "consumed"}
              />
              <p className={styles.hint}>
                Guduchi allocated sum: <code>{formatMilligrams(guduAMg)} g</code> / <code>37.500 g</code> required
              </p>
            </div>

            {consumptionNotice && (
              <div className={consumptionNotice.type === "error" ? styles.calloutError : styles.calloutInfo}>
                {consumptionNotice.text}
              </div>
            )}

            <div className={styles.actions}>
              <button type="button" className={styles.primaryBtn} onClick={handleConfirmConsumption}>
                {savedSnapshot.status === "consumed"
                  ? "Test Idempotent Retry (Same operationId)"
                  : "Confirm Actual Consumption (Atomic Deduction)"}
              </button>
              {savedSnapshot.status === "consumed" && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setBatches(INITIAL_BATCHES);
                    setSavedSnapshot((prev) => ({ ...prev, status: "prepared", confirmedAt: null }));
                    setConsumptionNotice(null);
                  }}
                >
                  Reset Preview to Prepared State
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: CONSUMED (IMMUTABLE CONFIRMED STATE) */}
          <div className={styles.panelConsumed}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>State B · Confirmed Actual Consumption (Immutable)</h2>
                <p className={styles.hint}>
                  Confirmed At: {savedSnapshot.confirmedAt ?? "31 Oct 2026, 14:10 · Asia/Colombo (Example)"} · Actor: <code>d-dispensary</code>
                </p>
              </div>
              <span className={styles.badgeConsumed}>Consumed · Stock Deducted</span>
            </div>

            <div className={styles.calloutInfo}>
              <strong>Immutable Consumption Record (PRE-04–05):</strong> Once confirmed, <code>batch_consumptions</code> rows are append-only, batch balances are reduced, and the preparation cannot be edited or confirmed a second time.
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Botanical Item</th>
                    <th>Consumed Batch Ref</th>
                    <th>Actual Deducted Grams</th>
                    <th>Operation ID</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Ashwagandha Root (<code>BOT-ASHWA-001</code>)</td>
                    <td className={styles.mono}>CLN-BATCH-2026-A01</td>
                    <td className={styles.mono}>
                      <strong>30.000 g</strong>
                    </td>
                    <td className={styles.mono}>7c4a1b9e…1111</td>
                  </tr>
                  <tr>
                    <td>Ashwagandha Root (<code>BOT-ASHWA-001</code>)</td>
                    <td className={styles.mono}>CLN-BATCH-2026-A02</td>
                    <td className={styles.mono}>
                      <strong>20.000 g</strong>
                    </td>
                    <td className={styles.mono}>7c4a1b9e…1111</td>
                  </tr>
                  <tr>
                    <td>Guduchi Stem (<code>BOT-GUDU-002</code>)</td>
                    <td className={styles.mono}>CLN-BATCH-2026-G01</td>
                    <td className={styles.mono}>
                      <strong>37.500 g</strong>
                    </td>
                    <td className={styles.mono}>7c4a1b9e…1111</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "traceability" && (
        <div className={styles.equalGrid}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Forward Trace: Batch → Recipient Patients (D-TRC-01)</h2>
              <span className={styles.badgeEligible}>Batch: CLN-BATCH-2026-A01</span>
            </div>
            <p className={styles.hint}>
              Shows all patients, therapy sessions, and preparations that consumed stock from <code>CLN-BATCH-2026-A01</code>.
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Patient &amp; Session</th>
                    <th>Preparation ID</th>
                    <th>Actual Grams</th>
                    <th>Confirmed (Colombo)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Synthetic Patient No ID</strong>
                      <div className={styles.hint}>
                        Patient: <code>b-no-identity</code> · Session: <code>c-session-01</code>
                      </div>
                    </td>
                    <td className={styles.mono}>d-prep-srs-scale</td>
                    <td className={styles.mono}>
                      <strong>30.000 g</strong>
                    </td>
                    <td className={styles.mono}>31 Oct 2026, 14:10</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Reverse Trace: Patient → Consumed Batches (D-TRC-02)</h2>
              <span className={styles.badgeConsumed}>Confirmed Only</span>
            </div>
            <p className={styles.hint}>
              Patient: <strong>Synthetic Patient No ID</strong> (<code>b-no-identity</code>). Minimum identity projection only; clinical consultation notes are never exposed (<code>IAM-04</code>).
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Consumed Batch</th>
                    <th>Botanical Item</th>
                    <th>Actual Grams</th>
                    <th>Preparation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={styles.mono}>CLN-BATCH-2026-A01</td>
                    <td>Ashwagandha Root</td>
                    <td className={styles.mono}>
                      <strong>30.000 g</strong>
                    </td>
                    <td className={styles.mono}>d-prep-srs-scale</td>
                  </tr>
                  <tr>
                    <td className={styles.mono}>CLN-BATCH-2026-A02</td>
                    <td>Ashwagandha Root</td>
                    <td className={styles.mono}>
                      <strong>20.000 g</strong>
                    </td>
                    <td className={styles.mono}>d-prep-srs-scale</td>
                  </tr>
                  <tr>
                    <td className={styles.mono}>CLN-BATCH-2026-G01</td>
                    <td>Guduchi Stem</td>
                    <td className={styles.mono}>
                      <strong>37.500 g</strong>
                    </td>
                    <td className={styles.mono}>d-prep-srs-scale</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className={styles.calloutInfo}>
              <strong>PRE-06 Unconsumed Exclusion Rule:</strong> Saved preparation <code>d-prep-unconsumed</code> (status: <code>Prepared · No Stock Deducted</code>) is excluded from this report because a saved recipe snapshot alone is not proof of batch consumption.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
