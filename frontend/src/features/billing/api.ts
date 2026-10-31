import { APIRequestError, apiGet, apiMutation, StaffSession } from "@/lib/api-client";
import {
  Invoice,
  InvoiceItem,
  InvoicePage,
  InvoiceBalance,
  Receipt,
  OutstandingReport,
  CreateInvoiceRequest,
  AddItemRequest,
  PostReceiptRequest,
} from "./types";

export async function getBillingSession(): Promise<StaffSession> {
  const session = await apiGet<StaffSession>("/auth/session");
  const hasAccess = session.roles.some((r) => r === "billing" || r === "receptionist" || r === "report_reader");
  if (!hasAccess) {
    throw new APIRequestError(403, "forbidden", "Billing access is not permitted for this account.");
  }
  return session;
}

export function createInvoice(input: CreateInvoiceRequest): Promise<Invoice> {
  return apiMutation<Invoice>("/invoices", input, "POST");
}

export function getInvoice(id: string): Promise<Invoice> {
  return apiGet<Invoice>(`/invoices/${encodeURIComponent(id)}`);
}

export function listInvoicesForPatient(patientId: string, limit = 25, after?: string): Promise<InvoicePage> {
  let url = `/invoices?patientId=${encodeURIComponent(patientId)}&limit=${limit}`;
  if (after) {
    url += `&after=${encodeURIComponent(after)}`;
  }
  return apiGet<InvoicePage>(url);
}

export function addInvoiceItem(invoiceId: string, input: AddItemRequest): Promise<InvoiceItem> {
  return apiMutation<InvoiceItem>(`/invoices/${encodeURIComponent(invoiceId)}/items`, input, "POST");
}

export function removeInvoiceItem(invoiceId: string, itemId: string): Promise<void> {
  return apiMutation<void>(`/invoices/${encodeURIComponent(invoiceId)}/items/${encodeURIComponent(itemId)}`, undefined, "DELETE");
}

export function issueInvoice(invoiceId: string): Promise<Invoice> {
  return apiMutation<Invoice>(`/invoices/${encodeURIComponent(invoiceId)}/issue`, {}, "POST");
}

export function voidInvoice(invoiceId: string): Promise<void> {
  return apiMutation<void>(`/invoices/${encodeURIComponent(invoiceId)}/void`, {}, "POST");
}

export function postReceipt(invoiceId: string, input: PostReceiptRequest): Promise<Receipt> {
  return apiMutation<Receipt>(`/invoices/${encodeURIComponent(invoiceId)}/receipts`, input, "POST");
}

export function getInvoiceBalance(invoiceId: string): Promise<InvoiceBalance> {
  return apiGet<InvoiceBalance>(`/invoices/${encodeURIComponent(invoiceId)}/balance`);
}

export function listReceipts(invoiceId: string): Promise<{ items: Receipt[] }> {
  return apiGet<{ items: Receipt[] }>(`/invoices/${encodeURIComponent(invoiceId)}/receipts`);
}

export function getOutstandingReport(): Promise<OutstandingReport> {
  return apiGet<OutstandingReport>("/reports/billing/outstanding");
}
