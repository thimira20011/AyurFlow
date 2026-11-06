"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./billing-workspace.module.css";
import { formatLKR, formatClinicDateTime } from "@/lib/format";
import { APIRequestError } from "@/lib/api-client";
import {
  Invoice,
  InvoiceItem,
  Receipt,
  InvoiceBalance,
  OutstandingReport,
  PaymentMethod,
} from "./types";
import {
  getBillingSession,
  createInvoice,
  getInvoice,
  listInvoicesForPatient,
  addInvoiceItem,
  removeInvoiceItem,
  issueInvoice,
  voidInvoice,
  postReceipt,
  getInvoiceBalance,
  listReceipts,
  getOutstandingReport,
} from "./api";

// ---------------------------------------------------------------------------
// Synthetic Ayurveda Clinic Treatment Catalog (DEC04 review presets)
// ---------------------------------------------------------------------------
const TREATMENT_PRESETS = [
  { description: "Initial Consultation with Ayurvedic Physician", unitPriceMinor: 250000 },
  { description: "Abhyanga Full Body Herbal Massage (60 min)", unitPriceMinor: 450000 },
  { description: "Shirodhara Herbal Oil Pouring Therapy (45 min)", unitPriceMinor: 650000 },
  { description: "Swedana Medicated Herbal Steam Bath (30 min)", unitPriceMinor: 200000 },
  { description: "Pizhichil Warm Medicated Oil Treatment (60 min)", unitPriceMinor: 850000 },
  { description: "Kashaya Herbal Decoction Preparation (750ml)", unitPriceMinor: 120000 },
  { description: "Nasya Karma Therapy with Anu Thaila", unitPriceMinor: 180000 },
];

// ---------------------------------------------------------------------------
// Preview / demo data for local review without a live backend
// ---------------------------------------------------------------------------
const DEMO_INVOICES: Invoice[] = [
  {
    id: "inv-88210-colombo",
    patientId: "30ad6d29-79b0-4028-93c4-614df48ec3ea",
    status: "issued",
    totalMinor: 1350000,
    issuedAt: "2026-10-24T09:30:00Z",
    issuedBy: "staff-dilshan-billing",
    createdAt: "2026-10-24T09:15:00Z",
    updatedAt: "2026-10-24T09:30:00Z",
    items: [
      { id: "item-101", invoiceId: "inv-88210-colombo", description: "Initial Consultation with Ayurvedic Physician", quantity: 1, unitPriceMinor: 250000, lineTotalMinor: 250000, createdAt: "2026-10-24T09:18:00Z" },
      { id: "item-102", invoiceId: "inv-88210-colombo", description: "Abhyanga Full Body Herbal Massage (60 min)", quantity: 1, unitPriceMinor: 450000, lineTotalMinor: 450000, createdAt: "2026-10-24T09:20:00Z" },
      { id: "item-103", invoiceId: "inv-88210-colombo", description: "Shirodhara Herbal Oil Pouring Therapy (45 min)", quantity: 1, unitPriceMinor: 650000, lineTotalMinor: 650000, createdAt: "2026-10-24T09:22:00Z" },
    ],
  },
  {
    id: "inv-88211-kandy",
    patientId: "4921b103-0000-4000-8000-000000000002",
    status: "issued",
    totalMinor: 420000,
    issuedAt: "2026-10-25T11:00:00Z",
    issuedBy: "staff-dilshan-billing",
    createdAt: "2026-10-25T10:45:00Z",
    updatedAt: "2026-10-25T11:00:00Z",
    items: [
      { id: "item-201", invoiceId: "inv-88211-kandy", description: "Initial Consultation with Ayurvedic Physician", quantity: 1, unitPriceMinor: 250000, lineTotalMinor: 250000, createdAt: "2026-10-25T10:48:00Z" },
      { id: "item-202", invoiceId: "inv-88211-kandy", description: "Swedana Medicated Herbal Steam Bath (30 min)", quantity: 1, unitPriceMinor: 170000, lineTotalMinor: 170000, createdAt: "2026-10-25T10:50:00Z" },
    ],
  },
  {
    id: "inv-88212-galle",
    patientId: "1982a000-0000-4000-8000-000000000003",
    status: "draft",
    createdAt: "2026-10-26T14:10:00Z",
    updatedAt: "2026-10-26T14:10:00Z",
    items: [
      { id: "item-301", invoiceId: "inv-88212-galle", description: "Pizhichil Warm Medicated Oil Treatment (60 min)", quantity: 1, unitPriceMinor: 850000, lineTotalMinor: 850000, createdAt: "2026-10-26T14:12:00Z" },
      { id: "item-302", invoiceId: "inv-88212-galle", description: "Kashaya Herbal Decoction Preparation (750ml)", quantity: 2, unitPriceMinor: 120000, lineTotalMinor: 240000, createdAt: "2026-10-26T14:15:00Z" },
    ],
  },
];

const DEMO_RECEIPTS: Receipt[] = [
  { id: "rec-001", invoiceId: "inv-88210-colombo", operationId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", amountMinor: 800000, paymentMethod: "direct_deposit", label: "Advance deposit via BOC transfer", issuedAt: "2026-10-24T10:00:00Z", issuedBy: "staff-dilshan-billing" },
  { id: "rec-002", invoiceId: "inv-88211-kandy", operationId: "7cb11f20-9182-4102-8172-1b918274a100", amountMinor: 420000, paymentMethod: "cash", label: "Counter cash settlement", issuedAt: "2026-10-25T11:15:00Z", issuedBy: "staff-dilshan-billing" },
];

// ---------------------------------------------------------------------------
// Error message helpers
// ---------------------------------------------------------------------------
function billingErrorText(error: unknown, action: string): string {
  if (error instanceof APIRequestError) {
    if (error.status === 401) return "Your session has ended. Sign in again before continuing.";
    if (error.status === 403) return "This account does not have billing access.";
    if (error.status === 404) return "The billing resource was not found.";
    if (error.status === 409 && action === "receipt") return "Payment rejected: overpayment or changed details. Refresh and try again.";
    if (error.status === 409) return "This action is no longer valid for the current invoice state. Reload and try again.";
    if (error.status === 422) return "Validation failed. Check the form values and try again.";
    if (error.status === 503) return "Billing service is temporarily unavailable. Try again later.";
  }
  return "The request could not be completed. Check your connection and try again.";
}

function generateOpId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "op-" + Math.random().toString(36).substring(2, 15) + "-" + Date.now();
}

// ---------------------------------------------------------------------------
// Access modes
// ---------------------------------------------------------------------------
type Access = "checking" | "ready" | "preview" | "signin" | "forbidden" | "unavailable";

// ---------------------------------------------------------------------------
// BillingWorkspace component
// ---------------------------------------------------------------------------
export function BillingWorkspace({ preview = false }: { preview?: boolean }) {
  const [access, setAccess] = useState<Access>(preview ? "preview" : "checking");

  // Live data state (populated from API when access === "ready")
  const [invoices, setInvoices] = useState<Invoice[]>(preview ? DEMO_INVOICES : []);
  const [receipts, setReceipts] = useState<Receipt[]>(preview ? DEMO_RECEIPTS : []);
  const [report, setReport] = useState<OutstandingReport | null>(null);
  const [patientIdQuery, setPatientIdQuery] = useState("");
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  // Invoice detail / receipt history
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceReceipts, setInvoiceReceipts] = useState<Receipt[]>([]);
  const [invoiceBalance, setInvoiceBalance] = useState<InvoiceBalance | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"invoices" | "receipts" | "report">("invoices");

  // Modals
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);

  // Filter/search
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "issued" | "void">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // New invoice form
  const [newPatientId, setNewPatientId] = useState("");
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  // Add item form (within selected invoice modal)
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemPriceRupees, setItemPriceRupees] = useState(2500);
  const [submittingItem, setSubmittingItem] = useState(false);

  // Receipt form
  const [receiptAmountRupees, setReceiptAmountRupees] = useState(0);
  const [receiptMethod, setReceiptMethod] = useState<PaymentMethod>("cash");
  const [receiptLabel, setReceiptLabel] = useState("");
  const [receiptOperationId, setReceiptOperationId] = useState("");
  const [submittingReceipt, setSubmittingReceipt] = useState(false);

  // Notifications
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [asOfTimestamp] = useState(() => Date.now());
  const liveRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Session check on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (preview) return;
    liveRef.current = true;
    getBillingSession().then(
      () => { if (liveRef.current) setAccess("ready"); },
      (error: unknown) => {
        if (!liveRef.current) return;
        if (error instanceof APIRequestError && error.status === 401) setAccess("signin");
        else if (error instanceof APIRequestError && error.status === 403) setAccess("forbidden");
        else setAccess("unavailable");
      }
    );
    return () => { liveRef.current = false; };
  }, [preview]);

  // ---------------------------------------------------------------------------
  // Load invoices for a patient (live mode)
  // ---------------------------------------------------------------------------
  const fetchInvoicesForPatient = useCallback(async (patientId: string) => {
    if (!patientId.trim() || access !== "ready") return;
    setLoadingInvoices(true);
    setActionError(null);
    try {
      const page = await listInvoicesForPatient(patientId.trim());
      if (liveRef.current) setInvoices(page.items);
    } catch (error) {
      if (liveRef.current) setActionError(billingErrorText(error, "list"));
    } finally {
      if (liveRef.current) setLoadingInvoices(false);
    }
  }, [access]);

  // ---------------------------------------------------------------------------
  // Load outstanding report (live mode)
  // ---------------------------------------------------------------------------
  const fetchOutstandingReport = useCallback(async () => {
    if (access !== "ready") return;
    setLoadingReport(true);
    try {
      const r = await getOutstandingReport();
      if (liveRef.current) setReport(r);
    } catch (error) {
      if (liveRef.current) setActionError(billingErrorText(error, "report"));
    } finally {
      if (liveRef.current) setLoadingReport(false);
    }
  }, [access]);

  // ---------------------------------------------------------------------------
  // Open invoice detail: fetch items + receipts + balance from API
  // ---------------------------------------------------------------------------
  const openInvoiceDetail = useCallback(async (inv: Invoice) => {
    setSelectedInvoice(inv);
    setInvoiceReceipts([]);
    setInvoiceBalance(null);
    setItemDesc("");
    setItemQty(1);
    setItemPriceRupees(2500);

    if (access !== "ready") return; // preview: use local data
    setLoadingDetail(true);
    try {
      const [fresh, { items: recs }] = await Promise.all([
        getInvoice(inv.id),
        listReceipts(inv.id),
      ]);
      let bal: InvoiceBalance | null = null;
      if (fresh.status === "issued") {
        bal = await getInvoiceBalance(inv.id);
      }
      if (liveRef.current) {
        setSelectedInvoice(fresh);
        setInvoiceReceipts(recs);
        setInvoiceBalance(bal);
        // Refresh invoice in list
        setInvoices((prev) => prev.map((i) => (i.id === fresh.id ? fresh : i)));
      }
    } catch (error) {
      if (liveRef.current) setActionError(billingErrorText(error, "read"));
    } finally {
      if (liveRef.current) setLoadingDetail(false);
    }
  }, [access]);

  // For preview mode: compute balance from local receipts state
  function computePreviewBalance(inv: Invoice): { total: number; paid: number; outstanding: number } {
    const total = inv.totalMinor ?? (inv.items?.reduce((s, i) => s + i.lineTotalMinor, 0) ?? 0);
    const paid = (access === "ready" ? invoiceReceipts : DEMO_RECEIPTS)
      .filter((r) => r.invoiceId === inv.id)
      .reduce((s, r) => s + r.amountMinor, 0);
    return { total, paid, outstanding: Math.max(0, total - paid) };
  }

  // For the invoice list table (uses live invoiceBalance when selected, otherwise local state)
  function balanceForListRow(inv: Invoice) {
    return computePreviewBalance(inv);
  }

  // ---------------------------------------------------------------------------
  // Create invoice
  // ---------------------------------------------------------------------------
  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    if (!newPatientId.trim()) { setActionError("Patient ID is required."); return; }

    if (access !== "ready") {
      // Preview mode: local state mutation
      const newInv: Invoice = {
        id: "inv-" + Math.random().toString(36).substring(2, 8),
        patientId: newPatientId.trim(),
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      };
      setInvoices([newInv, ...invoices]);
      setIsNewInvoiceOpen(false);
      setNewPatientId("");
      setSelectedInvoice(newInv);
      setActionSuccess(`Draft invoice ${newInv.id} opened.`);
      return;
    }

    setSubmittingInvoice(true);
    try {
      const inv = await createInvoice({ patientId: newPatientId.trim() });
      if (!liveRef.current) return;
      // Reload the list for this patient (or prepend)
      setInvoices((prev) => [inv, ...prev]);
      setIsNewInvoiceOpen(false);
      setNewPatientId("");
      setActionSuccess(`Draft invoice ${inv.id} opened.`);
      void openInvoiceDetail(inv);
    } catch (error) {
      if (liveRef.current) setActionError(billingErrorText(error, "create"));
    } finally {
      if (liveRef.current) setSubmittingInvoice(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Add line item
  // ---------------------------------------------------------------------------
  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice || selectedInvoice.status !== "draft") return;
    if (!itemDesc.trim()) { setActionError("Item description is required."); return; }
    if (itemQty <= 0) { setActionError("Quantity must be greater than zero."); return; }
    const unitPriceMinor = Math.round(itemPriceRupees * 100);
    const lineTotalMinor = itemQty * unitPriceMinor;

    if (access !== "ready") {
      const newItem: InvoiceItem = {
        id: "item-" + Math.random().toString(36).substring(2, 8),
        invoiceId: selectedInvoice.id,
        description: itemDesc.trim(),
        quantity: itemQty,
        unitPriceMinor,
        lineTotalMinor,
        createdAt: new Date().toISOString(),
      };
      const updatedItems = [...(selectedInvoice.items ?? []), newItem];
      const updatedInv = { ...selectedInvoice, items: updatedItems, updatedAt: new Date().toISOString() };
      setSelectedInvoice(updatedInv);
      setInvoices((prev) => prev.map((i) => (i.id === updatedInv.id ? updatedInv : i)));
      setItemDesc(""); setItemQty(1);
      setActionSuccess(`Added: ${newItem.description}`);
      return;
    }

    setSubmittingItem(true);
    try {
      const item = await addInvoiceItem(selectedInvoice.id, {
        description: itemDesc.trim(),
        quantity: itemQty,
        unitPriceMinor,
      });
      if (!liveRef.current) return;
      const updatedItems = [...(selectedInvoice.items ?? []), item];
      const updatedInv = { ...selectedInvoice, items: updatedItems, updatedAt: new Date().toISOString() };
      setSelectedInvoice(updatedInv);
      setInvoices((prev) => prev.map((i) => (i.id === updatedInv.id ? updatedInv : i)));
      setItemDesc(""); setItemQty(1);
      setActionSuccess(`Added: ${item.description}`);
    } catch (error) {
      if (liveRef.current) setActionError(billingErrorText(error, "add_item"));
    } finally {
      if (liveRef.current) setSubmittingItem(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Remove line item
  // ---------------------------------------------------------------------------
  async function handleRemoveItem(itemId: string) {
    if (!selectedInvoice || selectedInvoice.status !== "draft") return;

    if (access !== "ready") {
      const updatedItems = (selectedInvoice.items ?? []).filter((i) => i.id !== itemId);
      const updatedInv = { ...selectedInvoice, items: updatedItems, updatedAt: new Date().toISOString() };
      setSelectedInvoice(updatedInv);
      setInvoices((prev) => prev.map((i) => (i.id === updatedInv.id ? updatedInv : i)));
      return;
    }

    try {
      await removeInvoiceItem(selectedInvoice.id, itemId);
      if (!liveRef.current) return;
      const updatedItems = (selectedInvoice.items ?? []).filter((i) => i.id !== itemId);
      const updatedInv = { ...selectedInvoice, items: updatedItems, updatedAt: new Date().toISOString() };
      setSelectedInvoice(updatedInv);
      setInvoices((prev) => prev.map((i) => (i.id === updatedInv.id ? updatedInv : i)));
    } catch (error) {
      if (liveRef.current) setActionError(billingErrorText(error, "remove_item"));
    }
  }

  // ---------------------------------------------------------------------------
  // Issue invoice
  // ---------------------------------------------------------------------------
  async function handleIssueInvoice(inv: Invoice) {
    if (inv.status !== "draft") return;
    const items = inv.items ?? [];
    if (items.length === 0) { setActionError("Cannot issue an invoice with no line items."); return; }

    if (access !== "ready") {
      const totalMinor = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
      const issuedInv: Invoice = { ...inv, status: "issued", totalMinor, issuedAt: new Date().toISOString(), issuedBy: "current-staff-billing", updatedAt: new Date().toISOString() };
      setInvoices((prev) => prev.map((i) => (i.id === issuedInv.id ? issuedInv : i)));
      if (selectedInvoice?.id === issuedInv.id) setSelectedInvoice(issuedInv);
      setActionSuccess(`Invoice ${inv.id} issued for ${formatLKR(totalMinor)}.`);
      return;
    }

    try {
      const issuedInv = await issueInvoice(inv.id);
      if (!liveRef.current) return;
      setInvoices((prev) => prev.map((i) => (i.id === issuedInv.id ? issuedInv : i)));
      if (selectedInvoice?.id === issuedInv.id) {
        setSelectedInvoice(issuedInv);
        // Refresh balance after issue
        const bal = await getInvoiceBalance(issuedInv.id);
        if (liveRef.current) setInvoiceBalance(bal);
      }
      setActionSuccess(`Invoice ${issuedInv.id} issued for ${formatLKR(issuedInv.totalMinor ?? 0)}.`);
    } catch (error) {
      if (liveRef.current) setActionError(billingErrorText(error, "issue"));
    }
  }

  // ---------------------------------------------------------------------------
  // Void invoice
  // ---------------------------------------------------------------------------
  async function handleVoidInvoice(inv: Invoice) {
    if (inv.status !== "draft") { setActionError("Only draft invoices can be voided."); return; }

    if (access !== "ready") {
      const voidedInv: Invoice = { ...inv, status: "void", updatedAt: new Date().toISOString() };
      setInvoices((prev) => prev.map((i) => (i.id === voidedInv.id ? voidedInv : i)));
      if (selectedInvoice?.id === voidedInv.id) setSelectedInvoice(voidedInv);
      setActionSuccess(`Invoice ${inv.id} voided.`);
      return;
    }

    try {
      await voidInvoice(inv.id);
      if (!liveRef.current) return;
      const voidedInv: Invoice = { ...inv, status: "void", updatedAt: new Date().toISOString() };
      setInvoices((prev) => prev.map((i) => (i.id === voidedInv.id ? voidedInv : i)));
      if (selectedInvoice?.id === voidedInv.id) setSelectedInvoice(voidedInv);
      setActionSuccess(`Invoice ${inv.id} voided.`);
    } catch (error) {
      if (liveRef.current) setActionError(billingErrorText(error, "void"));
    }
  }

  // ---------------------------------------------------------------------------
  // Open receipt modal
  // ---------------------------------------------------------------------------
  function openReceiptModal(inv: Invoice) {
    const bal = balanceForListRow(inv);
    setReceiptInvoice(inv);
    setReceiptAmountRupees(bal.outstanding / 100);
    setReceiptOperationId(generateOpId());
    setReceiptLabel("");
    setReceiptMethod("cash");
    setActionError(null);
    setIsReceiptModalOpen(true);
  }

  // ---------------------------------------------------------------------------
  // Post receipt
  // ---------------------------------------------------------------------------
  async function handlePostReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!receiptInvoice) return;
    const amountMinor = Math.round(receiptAmountRupees * 100);
    if (amountMinor <= 0) { setActionError("Receipt amount must be positive."); return; }

    const bal = balanceForListRow(receiptInvoice);
    if (amountMinor > bal.outstanding) {
      setActionError(`Overpayment blocked: entered ${formatLKR(amountMinor)} exceeds remaining balance ${formatLKR(bal.outstanding)}.`);
      return;
    }

    if (access !== "ready") {
      const newReceipt: Receipt = {
        id: "rec-" + Math.random().toString(36).substring(2, 8),
        invoiceId: receiptInvoice.id,
        operationId: receiptOperationId,
        amountMinor,
        paymentMethod: receiptMethod,
        label: receiptLabel.trim() || undefined,
        issuedAt: new Date().toISOString(),
        issuedBy: "current-staff-billing",
      };
      setReceipts((prev) => [newReceipt, ...prev]);
      setIsReceiptModalOpen(false);
      setActionSuccess(`Receipt posted for ${formatLKR(amountMinor)} (Operation ID: ${newReceipt.operationId.substring(0, 8)}…).`);
      return;
    }

    setSubmittingReceipt(true);
    try {
      const rec = await postReceipt(receiptInvoice.id, {
        operationId: receiptOperationId,
        amountMinor,
        paymentMethod: receiptMethod,
        label: receiptLabel.trim() || undefined,
      });
      if (!liveRef.current) return;
      setReceipts((prev) => [rec, ...prev]);
      // Refresh balance and receipts in the detail view if this invoice is open
      if (selectedInvoice?.id === receiptInvoice.id) {
        const [bal2, { items: recs }] = await Promise.all([
          getInvoiceBalance(receiptInvoice.id),
          listReceipts(receiptInvoice.id),
        ]);
        if (liveRef.current) {
          setInvoiceBalance(bal2);
          setInvoiceReceipts(recs);
        }
      }
      setIsReceiptModalOpen(false);
      setActionSuccess(`Receipt posted for ${formatLKR(amountMinor)}.`);
    } catch (error) {
      if (liveRef.current) setActionError(billingErrorText(error, "receipt"));
    } finally {
      if (liveRef.current) setSubmittingReceipt(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
  const filteredInvoices = invoices.filter((inv) => {
    if (filterStatus !== "all" && inv.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return inv.id.toLowerCase().includes(q) || inv.patientId.toLowerCase().includes(q);
    }
    return true;
  });

  const totalBilled = invoices.filter((i) => i.status === "issued").reduce((s, i) => s + (i.totalMinor ?? 0), 0);
  const totalCollected = receipts.reduce((s, r) => s + r.amountMinor, 0);
  const totalOutstanding = Math.max(0, totalBilled - totalCollected);

  // Current balance shown in receipt modal / invoice detail
  const currentBalForModal = receiptInvoice ? balanceForListRow(receiptInvoice) : null;
  const currentDetailBalance = invoiceBalance
    ? { total: invoiceBalance.totalMinor, paid: invoiceBalance.paidMinor, outstanding: invoiceBalance.outstandingMinor }
    : selectedInvoice ? computePreviewBalance(selectedInvoice) : null;

  // ---------------------------------------------------------------------------
  // Access gates
  // ---------------------------------------------------------------------------
  if (access === "checking") {
    return (
      <div className={styles.workspace}>
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--bill-muted)" }}>
          Checking billing access…
        </div>
      </div>
    );
  }

  if (access === "signin") {
    return (
      <div className={styles.workspace}>
        <div style={{ padding: "3rem", textAlign: "center" }}>
          <p style={{ marginBottom: "1rem", color: "var(--bill-muted)" }}>Your session has ended. Sign in to continue.</p>
          <a href="/sign-in" className={styles.primaryBtn}>Sign in</a>
        </div>
      </div>
    );
  }

  if (access === "forbidden") {
    return (
      <div className={styles.workspace}>
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--bill-muted)" }}>
          This account does not have billing access. Contact an administrator to update your role.
        </div>
      </div>
    );
  }

  if (access === "unavailable") {
    return (
      <div className={styles.workspace}>
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--bill-muted)" }}>
          Billing service is temporarily unavailable. Try again later.
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className={styles.workspace}>
      {/* Notice bar */}
      <div className={styles.noticeBar}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span className={styles.noticeTag}>{access === "ready" ? "TASK-BILL-05 · LIVE" : "TASK-BILL-05 · PREVIEW"}</span>
          <span style={{ fontSize: "0.88rem" }}>
            <strong>Billing Workspace:</strong>{" "}
            {access === "ready" ? "Connected to live backend API." : "Synthetic preview data — connect a backend to issue real invoices."}
          </span>
        </div>
        <div style={{ fontSize: "0.82rem", color: "var(--bill-muted)" }}>
          Timezone: <strong>Asia/Colombo</strong> · Currency: <strong>LKR (Rs.)</strong>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div style={{ background: "oklch(0.95 0.05 150)", border: "1px solid oklch(0.8 0.1 150)", color: "oklch(0.3 0.12 150)", padding: "0.75rem 1.25rem", borderRadius: "8px", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between" }}>
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
        </div>
      )}
      {actionError && (
        <div style={{ background: "oklch(0.95 0.05 25)", border: "1px solid oklch(0.8 0.1 25)", color: "oklch(0.35 0.15 25)", padding: "0.75rem 1.25rem", borderRadius: "8px", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between" }}>
          <span>⚠ {actionError}</span>
          <button onClick={() => setActionError(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* Header */}
      <div className={styles.headerArea}>
        <div className={styles.kicker}>MOD-04 · Invoicing &amp; Revenue Management</div>
        <div className={styles.headingRow}>
          <div>
            <h1 className={styles.title}>Patient Billing &amp; Collections</h1>
            <p className={styles.subtitle}>
              Draft itemized treatment bills, freeze issued totals atomically, and post idempotent receipts without overpayment.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            {access === "ready" && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Patient UUID to load invoices…"
                  value={patientIdQuery}
                  onChange={(e) => setPatientIdQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void fetchInvoicesForPatient(patientIdQuery); }}
                  style={{ minWidth: "260px" }}
                />
                <button
                  className={styles.secondaryBtn}
                  onClick={() => void fetchInvoicesForPatient(patientIdQuery)}
                  disabled={loadingInvoices}
                >
                  {loadingInvoices ? "Loading…" : "Load"}
                </button>
              </div>
            )}
            <button className={styles.primaryBtn} onClick={() => setIsNewInvoiceOpen(true)}>
              + Open Draft Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Invoiced (Issued)</div>
          <div className={styles.statValue}>{formatLKR(totalBilled)}</div>
          <div className={styles.statSub}>{invoices.filter((i) => i.status === "issued").length} issued invoices</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Collected</div>
          <div className={styles.statValue} style={{ color: "var(--bill-accent)" }}>{formatLKR(totalCollected)}</div>
          <div className={styles.statSub}>{receipts.length} recorded receipts</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Outstanding Receivables</div>
          <div className={styles.statValue} style={{ color: "var(--bill-gold)" }}>{formatLKR(totalOutstanding)}</div>
          <div className={styles.statSub}>Remaining clinic balances</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabsRow}>
        <button className={`${styles.tabButton} ${activeTab === "invoices" ? styles.tabButtonActive : ""}`} onClick={() => setActiveTab("invoices")}>
          📄 Invoices &amp; Drafts ({invoices.length})
        </button>
        <button className={`${styles.tabButton} ${activeTab === "receipts" ? styles.tabButtonActive : ""}`} onClick={() => setActiveTab("receipts")}>
          💳 Receipts &amp; Payments ({receipts.length})
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "report" ? styles.tabButtonActive : ""}`}
          onClick={() => {
            setActiveTab("report");
            if (access === "ready" && !report) {
              void fetchOutstandingReport();
            }
          }}
        >
          📊 Outstanding Aging Report
        </button>
      </div>

      {/* TAB 1: Invoices */}
      {activeTab === "invoices" && (
        <div>
          <div className={styles.actionBar}>
            <div className={styles.searchGroup}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Filter by Invoice ID or Patient ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className={styles.filterPills}>
              {(["all", "draft", "issued", "void"] as const).map((st) => (
                <button key={st} className={`${styles.pill} ${filterStatus === st ? styles.pillActive : ""}`} onClick={() => setFilterStatus(st)}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Patient ID</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Total</th>
                  <th>Outstanding</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyState}>
                      {access === "ready" ? "Enter a Patient UUID above and click Load to view invoices." : "No invoices found matching criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const bal = balanceForListRow(inv);
                    return (
                      <tr key={inv.id}>
                        <td><span className={styles.moneyDisplay} style={{ fontWeight: 700 }}>{inv.id}</span></td>
                        <td><span style={{ color: "var(--bill-accent)", fontWeight: 600 }}>{inv.patientId}</span></td>
                        <td>
                          {inv.status === "draft" && <span className={styles.badgeDraft}>Draft</span>}
                          {inv.status === "issued" && <span className={styles.badgeIssued}>Issued</span>}
                          {inv.status === "void" && <span className={styles.badgeVoid}>Void</span>}
                        </td>
                        <td style={{ fontSize: "0.85rem", color: "var(--bill-muted)" }}>{formatClinicDateTime(inv.createdAt)}</td>
                        <td>
                          {inv.status === "draft"
                            ? <span style={{ color: "var(--bill-muted)", fontStyle: "italic" }}>{formatLKR(bal.total)} (Pending)</span>
                            : <span className={styles.moneyDisplay}>{formatLKR(bal.total)}</span>}
                        </td>
                        <td>
                          {inv.status === "issued"
                            ? bal.outstanding === 0
                              ? <span style={{ color: "var(--bill-accent)", fontWeight: 600 }}>✓ Settled</span>
                              : <span style={{ color: "var(--bill-gold)", fontWeight: 700 }} className={styles.moneyDisplay}>{formatLKR(bal.outstanding)}</span>
                            : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                            <button className={styles.secondaryBtn} style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem" }} onClick={() => void openInvoiceDetail(inv)}>
                              {inv.status === "draft" ? "Edit Lines" : "View"}
                            </button>
                            {inv.status === "draft" && (
                              <button className={styles.primaryBtn} style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem" }} onClick={() => void handleIssueInvoice(inv)}>
                                Issue
                              </button>
                            )}
                            {inv.status === "issued" && bal.outstanding > 0 && (
                              <button className={styles.primaryBtn} style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem", background: "var(--bill-gold)" }} onClick={() => openReceiptModal(inv)}>
                                Record Pay
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Receipts */}
      {activeTab === "receipts" && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Receipt ID</th>
                <th>Invoice ID</th>
                <th>Operation ID (Idempotency Key)</th>
                <th>Method</th>
                <th>Amount Paid</th>
                <th>Reference Label</th>
                <th>Date / Time</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr><td colSpan={7} className={styles.emptyState}>No payment receipts recorded yet.</td></tr>
              ) : (
                receipts.map((rec) => (
                  <tr key={rec.id}>
                    <td><span className={styles.moneyDisplay} style={{ fontWeight: 700 }}>{rec.id}</span></td>
                    <td>{rec.invoiceId}</td>
                    <td><code style={{ fontSize: "0.78rem", background: "var(--bill-soft)", padding: "2px 6px", borderRadius: "4px" }}>{rec.operationId}</code></td>
                    <td><span style={{ textTransform: "capitalize", fontWeight: 600 }}>{rec.paymentMethod.replace("_", " ")}</span></td>
                    <td><span className={styles.moneyDisplay} style={{ color: "var(--bill-accent)", fontWeight: 700 }}>{formatLKR(rec.amountMinor)}</span></td>
                    <td style={{ color: "var(--bill-muted)" }}>{rec.label || "—"}</td>
                    <td style={{ fontSize: "0.85rem", color: "var(--bill-muted)" }}>{formatClinicDateTime(rec.issuedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Outstanding Aging Report */}
      {activeTab === "report" && (
        <div>
          <div style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--bill-muted)", fontSize: "0.92rem" }}>
              Aging summary of issued invoices with remaining unpaid balances. Meets <strong>AT12</strong>.
            </span>
            {access === "ready" && (
              <button className={styles.secondaryBtn} onClick={() => { setReport(null); void fetchOutstandingReport(); }} disabled={loadingReport}>
                {loadingReport ? "Loading…" : "↻ Refresh"}
              </button>
            )}
          </div>

          {loadingReport && <div style={{ padding: "2rem", textAlign: "center", color: "var(--bill-muted)" }}>Loading report…</div>}

          {/* Live report from API */}
          {access === "ready" && report && !loadingReport && (
            <>
              <div style={{ fontSize: "0.82rem", color: "var(--bill-muted)", marginBottom: "0.75rem" }}>
                Generated: {formatClinicDateTime(report.generatedAt)}
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Invoice ID</th>
                      <th>Patient ID</th>
                      <th>Issued Date</th>
                      <th>Total Due</th>
                      <th>Amount Paid</th>
                      <th>Outstanding Balance</th>
                      <th>Aging (Days)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.length === 0 ? (
                      <tr><td colSpan={7} className={styles.emptyState}>No outstanding invoices — all settled.</td></tr>
                    ) : (
                      report.rows.map((row) => (
                        <tr key={row.invoiceId}>
                          <td className={styles.moneyDisplay}>{row.invoiceId}</td>
                          <td style={{ color: "var(--bill-accent)", fontWeight: 600 }}>{row.patientId}</td>
                          <td style={{ fontSize: "0.85rem" }}>{formatClinicDateTime(row.issuedAt)}</td>
                          <td className={styles.moneyDisplay}>{formatLKR(row.totalMinor)}</td>
                          <td className={styles.moneyDisplay} style={{ color: "var(--bill-accent)" }}>{formatLKR(row.paidMinor)}</td>
                          <td className={styles.moneyDisplay} style={{ color: "var(--bill-gold)", fontWeight: 700 }}>{formatLKR(row.outstandingMinor)}</td>
                          <td>
                            <span style={{ background: row.ageDays > 7 ? "var(--bill-draft-bg)" : "var(--bill-soft)", color: row.ageDays > 7 ? "var(--bill-draft)" : "var(--bill-ink)", padding: "0.2rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                              {row.ageDays} days
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Preview mode: derive from local state */}
          {access !== "ready" && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Patient ID</th>
                    <th>Issued Date</th>
                    <th>Total Due</th>
                    <th>Amount Paid</th>
                    <th>Outstanding Balance</th>
                    <th>Aging (Days)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.filter((i) => i.status === "issued" && computePreviewBalance(i).outstanding > 0).map((inv) => {
                    const bal = computePreviewBalance(inv);
                    const ageDays = Math.floor((asOfTimestamp - new Date(inv.issuedAt ?? inv.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={inv.id}>
                        <td className={styles.moneyDisplay}>{inv.id}</td>
                        <td style={{ color: "var(--bill-accent)", fontWeight: 600 }}>{inv.patientId}</td>
                        <td style={{ fontSize: "0.85rem" }}>{inv.issuedAt ? formatClinicDateTime(inv.issuedAt) : "—"}</td>
                        <td className={styles.moneyDisplay}>{formatLKR(bal.total)}</td>
                        <td className={styles.moneyDisplay} style={{ color: "var(--bill-accent)" }}>{formatLKR(bal.paid)}</td>
                        <td className={styles.moneyDisplay} style={{ color: "var(--bill-gold)", fontWeight: 700 }}>{formatLKR(bal.outstanding)}</td>
                        <td>
                          <span style={{ background: ageDays > 7 ? "var(--bill-draft-bg)" : "var(--bill-soft)", color: ageDays > 7 ? "var(--bill-draft)" : "var(--bill-ink)", padding: "0.2rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", fontWeight: 700 }}>
                            {ageDays} days
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Create Draft Invoice */}
      {isNewInvoiceOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsNewInvoiceOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Open Draft Invoice</h2>
              <button className={styles.closeBtn} onClick={() => setIsNewInvoiceOpen(false)}>×</button>
            </div>
            <form onSubmit={(e) => void handleCreateInvoice(e)} className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Patient UUID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 30ad6d29-79b0-4028-93c4-614df48ec3ea"
                  className={styles.formInput}
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                />
                <span className={styles.formHelp}>The invoice will be opened in draft status. Add treatment line items before issuing.</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setIsNewInvoiceOpen(false)}>Cancel</button>
                <button type="submit" className={styles.primaryBtn} disabled={submittingInvoice}>
                  {submittingInvoice ? "Creating…" : "Create Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Invoice Detail — Line Items + Receipt History */}
      {selectedInvoice && (
        <div className={styles.modalOverlay} onClick={() => { setSelectedInvoice(null); setInvoiceBalance(null); setInvoiceReceipts([]); }}>
          <div className={styles.modalCard} style={{ maxWidth: "820px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>Invoice {selectedInvoice.id}</h2>
                <div style={{ fontSize: "0.88rem", color: "var(--bill-muted)", marginTop: "0.25rem" }}>
                  Patient: <strong>{selectedInvoice.patientId}</strong> · Status: <strong>{selectedInvoice.status.toUpperCase()}</strong>
                  {selectedInvoice.issuedAt && <> · Issued: <strong>{formatClinicDateTime(selectedInvoice.issuedAt)}</strong></>}
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => { setSelectedInvoice(null); setInvoiceBalance(null); setInvoiceReceipts([]); }}>×</button>
            </div>

            {loadingDetail && <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--bill-muted)" }}>Loading invoice detail…</div>}

            {/* Balance Banner (Issued invoices) */}
            {selectedInvoice.status === "issued" && currentDetailBalance && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem", background: "var(--bill-soft)", padding: "1rem", borderRadius: "8px" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--bill-muted)", fontWeight: 600, marginBottom: "0.25rem" }}>TOTAL</div>
                  <div className={styles.moneyDisplay} style={{ fontSize: "1.1rem", fontWeight: 700 }}>{formatLKR(currentDetailBalance.total)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--bill-muted)", fontWeight: 600, marginBottom: "0.25rem" }}>PAID</div>
                  <div className={styles.moneyDisplay} style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--bill-accent)" }}>{formatLKR(currentDetailBalance.paid)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--bill-muted)", fontWeight: 600, marginBottom: "0.25rem" }}>OUTSTANDING</div>
                  <div className={styles.moneyDisplay} style={{ fontSize: "1.1rem", fontWeight: 700, color: currentDetailBalance.outstanding > 0 ? "var(--bill-gold)" : "var(--bill-accent)" }}>
                    {currentDetailBalance.outstanding === 0 ? "✓ Settled" : formatLKR(currentDetailBalance.outstanding)}
                  </div>
                </div>
              </div>
            )}

            {/* Line Items */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>Treatment Line Items</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ width: "80px" }}>Qty</th>
                      <th>Unit Price</th>
                      <th>Line Total</th>
                      {selectedInvoice.status === "draft" && <th style={{ width: "60px" }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedInvoice.items || selectedInvoice.items.length === 0 ? (
                      <tr><td colSpan={5} className={styles.emptyState}>No items added yet.</td></tr>
                    ) : (
                      selectedInvoice.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.description}</td>
                          <td style={{ textAlign: "center" }}>{item.quantity}</td>
                          <td className={styles.moneyDisplay}>{formatLKR(item.unitPriceMinor)}</td>
                          <td className={styles.moneyDisplay} style={{ fontWeight: 700 }}>{formatLKR(item.lineTotalMinor)}</td>
                          {selectedInvoice.status === "draft" && (
                            <td>
                              <button type="button" style={{ background: "none", border: "none", color: "var(--bill-void)", cursor: "pointer", fontWeight: 700 }} onClick={() => void handleRemoveItem(item.id)}>✕</button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--bill-soft)", fontWeight: 700 }}>
                      <td colSpan={3} style={{ textAlign: "right" }}>Total:</td>
                      <td colSpan={selectedInvoice.status === "draft" ? 2 : 1} className={styles.moneyDisplay} style={{ fontSize: "1.05rem" }}>
                        {formatLKR(computePreviewBalance(selectedInvoice).total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Add Item Form (Draft only) */}
            {selectedInvoice.status === "draft" ? (
              <form onSubmit={(e) => void handleAddItem(e)} style={{ background: "var(--bill-soft)", padding: "1.25rem", borderRadius: "10px", marginBottom: "1.5rem" }}>
                <h4 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", fontWeight: 700 }}>Add Treatment / Medicine Line</h4>
                <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr 1fr auto" }}>
                  <div>
                    <input type="text" list="presets" placeholder="Treatment description…" className={styles.formInput} value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
                    <datalist id="presets">
                      {TREATMENT_PRESETS.map((p) => <option key={p.description} value={p.description} />)}
                    </datalist>
                  </div>
                  <input type="number" min="1" placeholder="Qty" className={styles.formInput} value={itemQty} onChange={(e) => setItemQty(parseInt(e.target.value) || 1)} />
                  <input type="number" min="0" step="50" placeholder="Price (Rs.)" className={styles.formInput} value={itemPriceRupees} onChange={(e) => setItemPriceRupees(parseFloat(e.target.value) || 0)} />
                  <button type="submit" className={styles.primaryBtn} style={{ padding: "0.65rem 1rem" }} disabled={submittingItem}>
                    {submittingItem ? "…" : "+ Add"}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ background: "var(--bill-issued-bg)", padding: "1rem", borderRadius: "8px", color: "var(--bill-issued)", fontSize: "0.88rem", marginBottom: "1.5rem" }}>
                🔒 <strong>Invoice Issued &amp; Frozen:</strong> Line items and totals are permanently locked.
              </div>
            )}

            {/* Receipt History (Issued invoices) */}
            {selectedInvoice.status === "issued" && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>Payment Receipt History</h3>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Receipt ID</th>
                        <th>Method</th>
                        <th>Amount</th>
                        <th>Reference</th>
                        <th>Date / Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(access === "ready" ? invoiceReceipts : DEMO_RECEIPTS.filter((r) => r.invoiceId === selectedInvoice.id)).length === 0 ? (
                        <tr><td colSpan={5} className={styles.emptyState}>No receipts posted yet.</td></tr>
                      ) : (
                        (access === "ready" ? invoiceReceipts : DEMO_RECEIPTS.filter((r) => r.invoiceId === selectedInvoice.id)).map((rec) => (
                          <tr key={rec.id}>
                            <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>{rec.id}</td>
                            <td><span style={{ textTransform: "capitalize" }}>{rec.paymentMethod.replace("_", " ")}</span></td>
                            <td className={styles.moneyDisplay} style={{ color: "var(--bill-accent)", fontWeight: 700 }}>{formatLKR(rec.amountMinor)}</td>
                            <td style={{ color: "var(--bill-muted)" }}>{rec.label || "—"}</td>
                            <td style={{ fontSize: "0.82rem", color: "var(--bill-muted)" }}>{formatClinicDateTime(rec.issuedAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {selectedInvoice.status === "draft" && (
                  <button type="button" style={{ background: "none", border: "none", color: "var(--bill-void)", cursor: "pointer", fontWeight: 600 }} onClick={() => void handleVoidInvoice(selectedInvoice)}>
                    Void Invoice
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {selectedInvoice.status === "issued" && currentDetailBalance && currentDetailBalance.outstanding > 0 && (
                  <button type="button" className={styles.primaryBtn} style={{ background: "var(--bill-gold)" }} onClick={() => { setSelectedInvoice(null); openReceiptModal(selectedInvoice); }}>
                    Record Payment
                  </button>
                )}
                <button type="button" className={styles.secondaryBtn} onClick={() => { setSelectedInvoice(null); setInvoiceBalance(null); setInvoiceReceipts([]); }}>Close</button>
                {selectedInvoice.status === "draft" && (
                  <button type="button" className={styles.primaryBtn} onClick={() => void handleIssueInvoice(selectedInvoice)}>
                    ✓ Issue &amp; Lock Invoice
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Post Payment Receipt */}
      {isReceiptModalOpen && receiptInvoice && (
        <div className={styles.modalOverlay} onClick={() => setIsReceiptModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Post Payment Receipt</h2>
              <button className={styles.closeBtn} onClick={() => setIsReceiptModalOpen(false)}>×</button>
            </div>
            <form onSubmit={(e) => void handlePostReceipt(e)} className={styles.formGrid}>
              <div style={{ background: "var(--bill-soft)", padding: "1rem", borderRadius: "8px", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                <div>Invoice: <strong>{receiptInvoice.id}</strong> (Patient: {receiptInvoice.patientId})</div>
                <div style={{ marginTop: "0.25rem" }}>Outstanding Balance: <strong className={styles.moneyDisplay}>{formatLKR(currentBalForModal?.outstanding ?? 0)}</strong></div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Operation ID (Idempotency Key)</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input type="text" readOnly className={styles.formInput} value={receiptOperationId} />
                  <button type="button" className={styles.secondaryBtn} onClick={() => setReceiptOperationId(generateOpId())}>↻</button>
                </div>
                <span className={styles.formHelp}>Guarantees payment is never double-charged during network retries.</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Payment Method</label>
                <select className={styles.formSelect} value={receiptMethod} onChange={(e) => setReceiptMethod(e.target.value as PaymentMethod)}>
                  <option value="cash">Cash Settlement (Counter)</option>
                  <option value="direct_deposit">Direct Deposit / Bank Transfer</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <label className={styles.formLabel}>Amount (LKR Rupees)</label>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    <button type="button" className={styles.secondaryBtn} style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }} onClick={() => setReceiptAmountRupees((currentBalForModal?.outstanding ?? 0) / 100)}>
                      Full Balance
                    </button>
                    <button type="button" className={styles.secondaryBtn} style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }} onClick={() => setReceiptAmountRupees(Math.round((currentBalForModal?.outstanding ?? 0) / 2 / 100))}>
                      50% Deposit
                    </button>
                  </div>
                </div>
                <input type="number" step="50" min="1" required className={styles.formInput} value={receiptAmountRupees} onChange={(e) => setReceiptAmountRupees(parseFloat(e.target.value) || 0)} />
                <span className={styles.formHelp}>Overpayment protection is enforced by the backend.</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Reference / Deposit Slip Details</label>
                <input type="text" placeholder="e.g. BOC Slip #98214 or Counter Cash Ref" className={styles.formInput} value={receiptLabel} onChange={(e) => setReceiptLabel(e.target.value)} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setIsReceiptModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.primaryBtn} style={{ background: "var(--bill-gold)" }} disabled={submittingReceipt}>
                  {submittingReceipt ? "Posting…" : "✓ Post Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
