"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./billing-workspace.module.css";
import { parseLKRMinor, toLKRInput } from "./money";
import { formatLKR, formatClinicDateTime } from "@/lib/format";
import { APIRequestError } from "@/lib/api-client";
import {
  Invoice,
  InvoiceItem,
  Receipt,
  OutstandingReport,
  PaymentMethod,
  PostReceiptRequest,
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
  const [receiptHistory, setReceiptHistory] = useState<Record<string, Receipt[]>>({});
  const [canWrite, setCanWrite] = useState(preview);
  const [canReadInvoices, setCanReadInvoices] = useState(preview);
  const [canReadReport, setCanReadReport] = useState(preview);
  const [report, setReport] = useState<OutstandingReport | null>(null);
  const [patientIdQuery, setPatientIdQuery] = useState("");
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  // Invoice detail / receipt history
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
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
  const [itemPriceRupees, setItemPriceRupees] = useState("2500.00");
  const [submittingItem, setSubmittingItem] = useState(false);

  // Receipt form
  const [receiptAmountRupees, setReceiptAmountRupees] = useState("");
  const [receiptMethod, setReceiptMethod] = useState<PaymentMethod>("cash");
  const [receiptLabel, setReceiptLabel] = useState("");
  const pendingReceipts = useRef<Record<string, PostReceiptRequest>>({});
  const [uncertainInvoices, setUncertainInvoices] = useState<string[]>([]);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [submittingReceipt, setSubmittingReceipt] = useState(false);

  // Notifications
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [asOfTimestamp] = useState(() => Date.now());
  const liveRef = useRef(true);
  const invoiceListRequest = useRef(0);
  const invoiceDetailRequest = useRef(0);

  // ---------------------------------------------------------------------------
  // Session check on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (preview) return;
    liveRef.current = true;
    getBillingSession().then(
      (session) => {
        if (!liveRef.current) return;
        const billing = session.roles.includes("billing");
        const invoiceAccess = billing || session.roles.includes("receptionist");
        setCanWrite(billing);
        setCanReadInvoices(invoiceAccess);
        setCanReadReport(billing || session.roles.includes("report_reader"));
        if (!invoiceAccess) setActiveTab("report");
        setAccess("ready");
      },
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
    const request = ++invoiceListRequest.current;
    const isCurrent = () => liveRef.current && request === invoiceListRequest.current;
    setLoadingInvoices(true);
    setActionError(null);
    try {
      const page = await listInvoicesForPatient(patientId.trim());
      const items = page.items ?? [];
      const issued = items.filter(invoice => invoice.status === "issued");
      const histories: Record<string, Receipt[]> = {};
      let historyUnavailable = false;
      for (let i = 0; i < issued.length && isCurrent(); i += 4) {
        await Promise.all(issued.slice(i, i + 4).map(async ({ id }) => {
          try {
            histories[id] = (await listReceipts(id)).items ?? [];
          } catch {
            historyUnavailable = true;
          }
        }));
      }
      if (!isCurrent()) return;
      setInvoices(items);
      setReceiptHistory(histories);
      setFilterStatus("all");
      setSearchQuery("");
      if (historyUnavailable) setActionError("Some balances could not be loaded. Open the invoice to try again.");
    } catch (error) {
      if (isCurrent()) setActionError(billingErrorText(error, "list"));
    } finally {
      if (isCurrent()) setLoadingInvoices(false);
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
    const request = ++invoiceDetailRequest.current;
    const isCurrent = () => liveRef.current && request === invoiceDetailRequest.current;
    setSelectedInvoice(inv);
    setDetailError(null);
    setItemDesc("");
    setItemQty(1);
    setItemPriceRupees("2500.00");

    if (access !== "ready") return;
    setLoadingDetail(true);
    try {
      const fresh = await getInvoice(inv.id);
      if (fresh.status === "draft") fresh.items ??= [];
      const recs = fresh.status === "issued" ? (await listReceipts(inv.id)).items ?? [] : [];
      if (isCurrent()) {
        setSelectedInvoice(fresh);
        setReceiptHistory(prev => ({ ...prev, [fresh.id]: recs }));
        setInvoices(prev => prev.map(i => i.id === fresh.id ? fresh : i));
      }
    } catch (error) {
      if (isCurrent()) setDetailError(billingErrorText(error, "read"));
    } finally {
      if (isCurrent()) setLoadingDetail(false);
    }
  }, [access]);

  function closeInvoiceDetail() {
    if (submittingItem) return;
    invoiceDetailRequest.current++;
    setSelectedInvoice(null);
    setLoadingDetail(false);
    setDetailError(null);
  }

  function invoiceTotal(inv: Invoice) {
    return inv.totalMinor ?? (inv.items ?? []).reduce((sum, item) => sum + item.lineTotalMinor, 0);
  }

  function balanceForListRow(inv: Invoice) {
    const total = invoiceTotal(inv);
    const history = receiptHistory[inv.id] ?? (preview ? DEMO_RECEIPTS.filter(r => r.invoiceId === inv.id) : undefined);
    if (!history && inv.status === "issued") return null;
    const paid = (history ?? []).reduce((sum, r) => sum + r.amountMinor, 0);
    return { total, paid, outstanding: total - paid };
  }

  // ---------------------------------------------------------------------------
  // Create invoice
  // ---------------------------------------------------------------------------
  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    if (!canWrite || submittingInvoice) return;
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
      setPatientIdQuery(inv.patientId);
      setInvoices(prev => [inv, ...prev.filter(i => i.patientId === inv.patientId)]);
      setFilterStatus("all");
      setSearchQuery("");
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
    if (!canWrite || submittingItem || loadingDetail || !selectedInvoice || selectedInvoice.status !== "draft") return;
    if (!itemDesc.trim()) { setDetailError("Item description is required."); return; }
    if (!Number.isInteger(itemQty) || itemQty <= 0) { setDetailError("Quantity must be a positive whole number."); return; }
    setDetailError(null);
    const unitPriceMinor = parseLKRMinor(itemPriceRupees);
    if (unitPriceMinor === null || !Number.isSafeInteger(itemQty * unitPriceMinor)) {
      setDetailError("Enter a valid unit price with at most two decimal places.");
      return;
    }
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
      if (liveRef.current) setDetailError(billingErrorText(error, "add_item"));
    } finally {
      if (liveRef.current) setSubmittingItem(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Remove line item
  // ---------------------------------------------------------------------------
  async function handleRemoveItem(itemId: string) {
    if (!canWrite || submittingItem || loadingDetail || !selectedInvoice || selectedInvoice.status !== "draft") return;

    if (access !== "ready") {
      const updatedItems = (selectedInvoice.items ?? []).filter((i) => i.id !== itemId);
      const updatedInv = { ...selectedInvoice, items: updatedItems, updatedAt: new Date().toISOString() };
      setSelectedInvoice(updatedInv);
      setInvoices((prev) => prev.map((i) => (i.id === updatedInv.id ? updatedInv : i)));
      return;
    }

    setSubmittingItem(true);
    setDetailError(null);
    try {
      await removeInvoiceItem(selectedInvoice.id, itemId);
      if (!liveRef.current) return;
      const updatedItems = (selectedInvoice.items ?? []).filter((i) => i.id !== itemId);
      const updatedInv = { ...selectedInvoice, items: updatedItems, updatedAt: new Date().toISOString() };
      setSelectedInvoice(updatedInv);
      setInvoices((prev) => prev.map((i) => (i.id === updatedInv.id ? updatedInv : i)));
    } catch (error) {
      if (liveRef.current) setDetailError(billingErrorText(error, "remove_item"));
    } finally {
      if (liveRef.current) setSubmittingItem(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Issue invoice
  // ---------------------------------------------------------------------------
  async function handleIssueInvoice(inv: Invoice) {
    if (!canWrite || submittingItem || loadingDetail || inv.status !== "draft") return;
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

    setSubmittingItem(true);
    setDetailError(null);
    try {
      const issuedInv = { ...await issueInvoice(inv.id), items };
      if (!liveRef.current) return;
      setInvoices((prev) => prev.map((i) => (i.id === issuedInv.id ? issuedInv : i)));
      setReport(null);
      void openInvoiceDetail(issuedInv);
      setActionSuccess(`Invoice ${issuedInv.id} issued for ${formatLKR(issuedInv.totalMinor ?? 0)}.`);
    } catch (error) {
      if (liveRef.current) setDetailError(billingErrorText(error, "issue"));
    } finally {
      if (liveRef.current) setSubmittingItem(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Void invoice
  // ---------------------------------------------------------------------------
  async function handleVoidInvoice(inv: Invoice) {
    if (!canWrite || submittingItem || loadingDetail || inv.status !== "draft") return;

    if (access !== "ready") {
      const voidedInv: Invoice = { ...inv, status: "void", updatedAt: new Date().toISOString() };
      setInvoices((prev) => prev.map((i) => (i.id === voidedInv.id ? voidedInv : i)));
      if (selectedInvoice?.id === voidedInv.id) setSelectedInvoice(voidedInv);
      setActionSuccess(`Invoice ${inv.id} voided.`);
      return;
    }

    setSubmittingItem(true);
    setDetailError(null);
    try {
      await voidInvoice(inv.id);
      if (!liveRef.current) return;
      const voidedInv: Invoice = { ...inv, status: "void", updatedAt: new Date().toISOString() };
      setInvoices((prev) => prev.map((i) => (i.id === voidedInv.id ? voidedInv : i)));
      if (selectedInvoice?.id === voidedInv.id) setSelectedInvoice(voidedInv);
      setActionSuccess(`Invoice ${inv.id} voided.`);
    } catch (error) {
      if (liveRef.current) setDetailError(billingErrorText(error, "void"));
    } finally {
      if (liveRef.current) setSubmittingItem(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Open receipt modal
  // ---------------------------------------------------------------------------
  function openReceiptModal(inv: Invoice) {
    const pending = pendingReceipts.current[inv.id];
    const bal = balanceForListRow(inv);
    if (!pending && (!bal || bal.outstanding <= 0)) return;
    setReceiptInvoice(inv);
    setReceiptAmountRupees(toLKRInput(pending?.amountMinor ?? bal?.outstanding ?? 0));
    setReceiptMethod(pending?.paymentMethod ?? "cash");
    setReceiptLabel(pending?.label ?? "");
    setReceiptError(null);
    setActionSuccess(null);
    setIsReceiptModalOpen(true);
  }

  function rememberReceipt(rec: Receipt) {
    setReceiptHistory(prev => {
      const existing = prev[rec.invoiceId] ?? (preview ? DEMO_RECEIPTS.filter(r => r.invoiceId === rec.invoiceId) : []);
      return { ...prev, [rec.invoiceId]: [rec, ...existing.filter(r => r.id !== rec.id)] };
    });
  }

  async function handlePostReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!receiptInvoice || !canWrite || submittingReceipt) return;
    setReceiptError(null);

    const invoiceId = receiptInvoice.id;
    let intent = pendingReceipts.current[invoiceId];
    if (!intent) {
      const amountMinor = parseLKRMinor(receiptAmountRupees);
      if (amountMinor === null || amountMinor <= 0) {
        setReceiptError("Enter a positive LKR amount with at most two decimal places.");
        return;
      }
      const label = receiptLabel.trim();
      if (receiptMethod === "direct_deposit" && !label) {
        setReceiptError("Enter a reference for the direct deposit.");
        return;
      }
      const bal = balanceForListRow(receiptInvoice);
      if (!bal || amountMinor > bal.outstanding) {
        setReceiptError("The payment exceeds the available balance. Review the invoice and try again.");
        return;
      }
      if (!globalThis.crypto?.randomUUID) {
        setReceiptError("Use a secure connection to record a payment.");
        return;
      }
      intent = { operationId: crypto.randomUUID(), amountMinor, paymentMethod: receiptMethod, label: label || undefined };
    }

    if (preview) {
      rememberReceipt({ ...intent, id: intent.operationId, invoiceId, issuedAt: new Date().toISOString(), issuedBy: "preview" });
      setIsReceiptModalOpen(false);
      return;
    }

    pendingReceipts.current[invoiceId] = intent;
    setSubmittingReceipt(true);
    try {
      const rec = await postReceipt(invoiceId, intent);
      delete pendingReceipts.current[invoiceId];
      if (!liveRef.current) return;
      setUncertainInvoices(prev => prev.filter(id => id !== invoiceId));
      rememberReceipt(rec);
      setIsReceiptModalOpen(false);
      setReport(null);
      setActionSuccess(`Receipt recorded for ${formatLKR(rec.amountMinor)}.`);
      void openInvoiceDetail(receiptInvoice);
    } catch (error) {
      if (!liveRef.current) return;
      // A known rejection of the first request allows edits. After an unknown
      // outcome, preserve the original request until its result is reconciled.
      if (!retryReceipt && error instanceof APIRequestError && [400, 401, 403, 404, 409, 422].includes(error.status)) {
        delete pendingReceipts.current[invoiceId];
        setReceiptError(billingErrorText(error, "receipt"));
      } else {
        setUncertainInvoices(prev => prev.includes(invoiceId) ? prev : [...prev, invoiceId]);
        setReceiptError("Receipt not confirmed. Retry this same payment before starting another.");
      }
    } finally {
      if (liveRef.current) setSubmittingReceipt(false);
    }
  }

  const filteredInvoices = invoices.filter((inv) => {
    if (filterStatus !== "all" && inv.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return inv.id.toLowerCase().includes(q) || inv.patientId.toLowerCase().includes(q);
    }
    return true;
  });

  const issuedInvoices = invoices.filter(i => i.status === "issued");
  const receipts = issuedInvoices.flatMap(i => receiptHistory[i.id] ?? (preview ? DEMO_RECEIPTS.filter(r => r.invoiceId === i.id) : []))
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const completeHistory = issuedInvoices.every(i => balanceForListRow(i) !== null);
  const totalBilled = issuedInvoices.reduce((s, i) => s + invoiceTotal(i), 0);
  const totalCollected = receipts.reduce((s, r) => s + r.amountMinor, 0);
  const totalOutstanding = totalBilled - totalCollected;
  const retryReceipt = !!receiptInvoice && uncertainInvoices.includes(receiptInvoice.id);
  const currentBalForModal = receiptInvoice ? balanceForListRow(receiptInvoice) : null;
  const currentDetailBalance = selectedInvoice ? balanceForListRow(selectedInvoice) : null;
  const invoiceReceipts = selectedInvoice
    ? receiptHistory[selectedInvoice.id] ?? (preview ? DEMO_RECEIPTS.filter(r => r.invoiceId === selectedInvoice.id) : [])
    : [];

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
          <span className={styles.noticeTag}>{preview ? "Preview" : "Billing"}</span>
          <span style={{ fontSize: "0.88rem" }}>
            <strong>Billing Workspace:</strong>{" "}
            {preview ? "Sample invoices and receipts for this browser session" : "Invoices, balances and receipts"}
          </span>
        </div>
        <div style={{ fontSize: "0.82rem", color: "var(--bill-muted)" }}>
          Timezone: <strong>Asia/Colombo</strong> · Currency: <strong>LKR (Rs.)</strong>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div style={{ background: "oklch(0.95 0.05 150)", border: "1px solid oklch(0.8 0.1 150)", color: "oklch(0.3 0.12 150)", padding: "0.75rem 1.25rem", borderRadius: "8px", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between" }}>
          <span role="status">{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} aria-label="Dismiss message" style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
        </div>
      )}
      {actionError && !isNewInvoiceOpen && (
        <div style={{ background: "oklch(0.95 0.05 25)", border: "1px solid oklch(0.8 0.1 25)", color: "oklch(0.35 0.15 25)", padding: "0.75rem 1.25rem", borderRadius: "8px", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between" }}>
          <span role="alert">{actionError}</span>
          <button onClick={() => setActionError(null)} aria-label="Dismiss error" style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* Header */}
      <div className={styles.headerArea}>
        <div className={styles.kicker}>MOD-04 · Invoicing &amp; Revenue Management</div>
        <div className={styles.headingRow}>
          <div>
            <h1 className={styles.title}>Patient Billing &amp; Collections</h1>
            <p className={styles.subtitle}>
              Prepare treatment invoices, record deposits and review payment history.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            {access === "ready" && canReadInvoices && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input
                  type="text"
                  className={styles.searchInput}
                  aria-label="Patient ID to load invoices" placeholder="Patient ID to load invoices…"
                  value={patientIdQuery}
                  onChange={(e) => setPatientIdQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !loadingInvoices) void fetchInvoicesForPatient(patientIdQuery); }}
                  style={{ width: "min(260px, 100%)" }}
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
            {canWrite && <button className={styles.primaryBtn} disabled={loadingInvoices} onClick={() => { setNewPatientId(patientIdQuery); setIsNewInvoiceOpen(true); }}>
              + Open Draft Invoice
            </button>}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {canReadInvoices && <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Loaded invoice totals</div>
          <div className={styles.statValue}>{formatLKR(totalBilled)}</div>
          <div className={styles.statSub}>{invoices.filter((i) => i.status === "issued").length} issued invoices</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Collected</div>
          <div className={styles.statValue} style={{ color: "var(--bill-accent)" }}>{completeHistory ? formatLKR(totalCollected) : "Unavailable"}</div>
          <div className={styles.statSub}>{receipts.length} recorded receipts</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Outstanding Receivables</div>
          <div className={styles.statValue} style={{ color: "var(--bill-gold)" }}>{completeHistory ? formatLKR(totalOutstanding) : "Unavailable"}</div>
          <div className={styles.statSub}>Balance on loaded invoices</div>
        </div>
      </div>}

      {/* Tabs */}
      <div className={styles.tabsRow}>
        {canReadInvoices && <><button className={`${styles.tabButton} ${activeTab === "invoices" ? styles.tabButtonActive : ""}`} onClick={() => setActiveTab("invoices")}>
          📄 Invoices &amp; Drafts ({invoices.length})
        </button>
        <button className={`${styles.tabButton} ${activeTab === "receipts" ? styles.tabButtonActive : ""}`} onClick={() => setActiveTab("receipts")}>
          💳 Receipts &amp; Payments ({receipts.length})
        </button>
        </>}
        {canReadReport && <button
          className={`${styles.tabButton} ${activeTab === "report" ? styles.tabButtonActive : ""}`}
          onClick={() => {
            setActiveTab("report");
            if (access === "ready" && !report) {
              void fetchOutstandingReport();
            }
          }}
        >
          📊 Outstanding Aging Report
        </button>}
      </div>

      {/* TAB 1: Invoices */}
      {activeTab === "invoices" && canReadInvoices && (
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
                      {access === "ready" ? "Load a patient’s invoices to see them here." : "No invoices found matching criteria."}
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
                            ? <span style={{ color: "var(--bill-muted)", fontStyle: "italic" }}>{inv.items ? formatLKR(invoiceTotal(inv)) : "—"} (Draft)</span>
                            : <span className={styles.moneyDisplay}>{inv.status === "issued" ? formatLKR(invoiceTotal(inv)) : "—"}</span>}
                        </td>
                        <td>
                          {inv.status === "issued"
                            ? !bal ? "Unavailable" : bal.outstanding === 0
                              ? <span style={{ color: "var(--bill-accent)", fontWeight: 600 }}>✓ Settled</span>
                              : <span style={{ color: "var(--bill-gold)", fontWeight: 700 }} className={styles.moneyDisplay}>{formatLKR(bal.outstanding)}</span>
                            : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                            <button className={styles.secondaryBtn} style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem" }} disabled={loadingInvoices} onClick={() => void openInvoiceDetail(inv)}>
                              {inv.status === "draft" && canWrite ? "Edit Lines" : "View"}
                            </button>
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
      {activeTab === "receipts" && canReadInvoices && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Receipt ID</th>
                <th>Invoice ID</th>
                <th>Method</th>
                <th>Amount Paid</th>
                <th>Reference Label</th>
                <th>Date / Time</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr><td colSpan={6} className={styles.emptyState}>{completeHistory ? "No receipts on the loaded invoices." : "Receipt history could not be loaded."}</td></tr>
              ) : (
                receipts.map((rec) => (
                  <tr key={rec.id}>
                    <td><span className={styles.moneyDisplay} style={{ fontWeight: 700 }}>{rec.id}</span></td>
                    <td>{rec.invoiceId}</td>
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
      {activeTab === "report" && canReadReport && (
        <div>
          <div style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--bill-muted)", fontSize: "0.92rem" }}>
              Issued invoices with a remaining balance, ordered by issue date.
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
                    {(report.rows ?? []).length === 0 ? (
                      <tr><td colSpan={7} className={styles.emptyState}>No outstanding invoices — all settled.</td></tr>
                    ) : (
                      (report.rows ?? []).map((row) => (
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
                  {invoices.filter((i) => i.status === "issued" && (balanceForListRow(i)?.outstanding ?? 0) > 0).map((inv) => {
                    const bal = balanceForListRow(inv)!;
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
          <div role="dialog" aria-modal="true" aria-labelledby="billing-draft-heading" className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 id="billing-draft-heading" className={styles.modalTitle}>Open Draft Invoice</h2>
              <button aria-label="Close draft form" className={styles.closeBtn} onClick={() => setIsNewInvoiceOpen(false)}>×</button>
            </div>
            {actionError && <p role="alert">{actionError}</p>}
            <form onSubmit={(e) => void handleCreateInvoice(e)} className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="billing-new-patient">Patient ID</label>
                <input
                  type="text"
                  required
                  id="billing-new-patient"
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
        <div className={styles.modalOverlay} onClick={closeInvoiceDetail}>
          <div role="dialog" aria-modal="true" aria-labelledby="billing-invoice-heading" className={styles.modalCard} style={{ maxWidth: "820px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 id="billing-invoice-heading" className={styles.modalTitle}>Invoice {selectedInvoice.id}</h2>
                <div style={{ fontSize: "0.88rem", color: "var(--bill-muted)", marginTop: "0.25rem" }}>
                  Patient: <strong>{selectedInvoice.patientId}</strong> · Status: <strong>{selectedInvoice.status.toUpperCase()}</strong>
                  {selectedInvoice.issuedAt && <> · Issued: <strong>{formatClinicDateTime(selectedInvoice.issuedAt)}</strong></>}
                </div>
              </div>
              <button aria-label="Close invoice" className={styles.closeBtn} onClick={closeInvoiceDetail}>×</button>
            </div>

            {detailError && <p role="alert">{detailError}</p>}
            {loadingDetail && <div role="status" style={{ padding: "1.5rem", textAlign: "center", color: "var(--bill-muted)" }}>Loading invoice detail…</div>}

            {/* Balance Banner (Issued invoices) */}
            {!loadingDetail && selectedInvoice.status === "issued" && currentDetailBalance && (
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
                      {selectedInvoice.status === "draft" && canWrite && <th style={{ width: "60px" }}></th>}
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
                          {selectedInvoice.status === "draft" && canWrite && (
                            <td>
                              <button type="button" style={{ background: "none", border: "none", color: "var(--bill-void)", cursor: "pointer", fontWeight: 700 }} disabled={loadingDetail || submittingItem} aria-label={`Remove ${item.description}`} onClick={() => void handleRemoveItem(item.id)}>✕</button>
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
                        {formatLKR(invoiceTotal(selectedInvoice))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Add Item Form (Draft only) */}
            {selectedInvoice.status === "draft" && canWrite && !loadingDetail && selectedInvoice.items !== undefined ? (
              <form onSubmit={(e) => void handleAddItem(e)} style={{ background: "var(--bill-soft)", padding: "1.25rem", borderRadius: "10px", marginBottom: "1.5rem" }}>
                <h4 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", fontWeight: 700 }}>Add Treatment / Medicine Line</h4>
                <div className={styles.lineFields}>
                  <div>
                    <input type="text" list="presets" aria-label="Treatment description" required placeholder="Treatment description…" className={styles.formInput} value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
                    <datalist id="presets">
                      {TREATMENT_PRESETS.map((p) => <option key={p.description} value={p.description} />)}
                    </datalist>
                  </div>
                  <input type="number" min="1" required aria-label="Quantity" placeholder="Qty" className={styles.formInput} value={itemQty} onChange={(e) => setItemQty(Number(e.target.value))} />
                  <input type="number" min="0" step="0.01" required aria-label="Unit price (LKR)" placeholder="Price (Rs.)" className={styles.formInput} value={itemPriceRupees} onChange={(e) => setItemPriceRupees(e.target.value)} />
                  <button type="submit" className={styles.primaryBtn} style={{ padding: "0.65rem 1rem" }} disabled={submittingItem}>
                    {submittingItem ? "…" : "+ Add"}
                  </button>
                </div>
              </form>
            ) : selectedInvoice.status === "issued" && (
              <div style={{ background: "var(--bill-issued-bg)", padding: "1rem", borderRadius: "8px", color: "var(--bill-issued)", fontSize: "0.88rem", marginBottom: "1.5rem" }}>
                🔒 <strong>Invoice Issued &amp; Frozen:</strong> Line items and totals are permanently locked.
              </div>
            )}

            {/* Receipt History (Issued invoices) */}
            {!loadingDetail && selectedInvoice.status === "issued" && currentDetailBalance && (
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
                      {invoiceReceipts.length === 0 ? (
                        <tr><td colSpan={5} className={styles.emptyState}>No receipts posted yet.</td></tr>
                      ) : (
                        invoiceReceipts.map((rec) => (
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
                {selectedInvoice.status === "draft" && canWrite && !loadingDetail && (
                  <button type="button" style={{ background: "none", border: "none", color: "var(--bill-void)", cursor: "pointer", fontWeight: 600 }} disabled={submittingItem} onClick={() => void handleVoidInvoice(selectedInvoice)}>
                    Void Invoice
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {selectedInvoice.status === "issued" && canWrite && !loadingDetail && !detailError && ((currentDetailBalance?.outstanding ?? 0) > 0 || uncertainInvoices.includes(selectedInvoice.id)) && (
                  <button type="button" className={styles.primaryBtn} style={{ background: "var(--bill-gold)" }} onClick={() => { closeInvoiceDetail(); openReceiptModal(selectedInvoice); }}>
                    Record Payment
                  </button>
                )}
                <button type="button" className={styles.secondaryBtn} onClick={closeInvoiceDetail}>Close</button>
                {selectedInvoice.status === "draft" && canWrite && !loadingDetail && (
                  <button type="button" className={styles.primaryBtn} disabled={submittingItem || !selectedInvoice.items?.length} onClick={() => void handleIssueInvoice(selectedInvoice)}>
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
        <div className={styles.modalOverlay} onClick={() => { if (!submittingReceipt) setIsReceiptModalOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="billing-receipt-heading" className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 id="billing-receipt-heading" className={styles.modalTitle}>Post Payment Receipt</h2>
              <button aria-label="Close receipt form" className={styles.closeBtn} disabled={submittingReceipt} onClick={() => setIsReceiptModalOpen(false)}>×</button>
            </div>
            <form onSubmit={(e) => void handlePostReceipt(e)} className={styles.formGrid}>
              <div style={{ background: "var(--bill-soft)", padding: "1rem", borderRadius: "8px", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                <div>Invoice: <strong>{receiptInvoice.id}</strong> (Patient: {receiptInvoice.patientId})</div>
                <div style={{ marginTop: "0.25rem" }}>Outstanding Balance: <strong className={styles.moneyDisplay}>{currentBalForModal ? formatLKR(currentBalForModal.outstanding) : "Unavailable"}</strong></div>
              </div>

              {receiptError && <p role="alert">{receiptError}</p>}
              {retryReceipt && <p>Retrying will check the result of the same payment.</p>}

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="billing-method">Payment Method</label>
                <select id="billing-method" disabled={submittingReceipt || retryReceipt} className={styles.formSelect} value={receiptMethod} onChange={(e) => setReceiptMethod(e.target.value as PaymentMethod)}>
                  <option value="cash">Cash Settlement (Counter)</option>
                  <option value="direct_deposit">Direct Deposit / Bank Transfer</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="billing-amount">Amount (LKR)</label>
                <input id="billing-amount" type="text" inputMode="decimal" required readOnly={submittingReceipt || retryReceipt} className={styles.formInput} value={receiptAmountRupees} onChange={(e) => setReceiptAmountRupees(e.target.value)} />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="billing-reference">Payment reference</label>
                <input id="billing-reference" required={receiptMethod === "direct_deposit"} readOnly={submittingReceipt || retryReceipt} type="text" placeholder="Deposit slip or counter reference" className={styles.formInput} value={receiptLabel} onChange={(e) => setReceiptLabel(e.target.value)} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button type="button" className={styles.secondaryBtn} disabled={submittingReceipt} onClick={() => setIsReceiptModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.primaryBtn} style={{ background: "var(--bill-gold)" }} disabled={submittingReceipt}>
                  {submittingReceipt ? "Posting…" : retryReceipt ? "Retry Receipt" : "Post Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
