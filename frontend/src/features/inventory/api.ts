import { apiGet, apiMutation } from "@/lib/api-client";

export type EligibilityStatus = "eligible" | "blocked" | "expired" | "unknown_expiry" | "depleted";

export type BotanicalItem = {
  id: string;
  code: string;
  displayName: string;
  baseUnit: string;
  active: boolean;
  deactivatedReason?: string;
  deactivatedBy?: string;
  deactivatedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type BotanicalItemPage = {
  items: BotanicalItem[];
  nextCursor: string | null;
};

export type StockBatch = {
  id: string;
  itemId: string;
  itemCode: string;
  itemDisplayName: string;
  batchReference: string;
  receivedGrams: string;
  remainingGrams: string;
  expiresAt: string | null;
  blocked: boolean;
  blockReason: string | null;
  blockedBy?: string;
  blockedAt?: string;
  eligibility: EligibilityStatus;
  receivedBy: string;
  receivedAt: string;
};

export type BatchSummaryTotals = {
  eligibleGrams: string;
  blockedGrams: string;
  expiredGrams: string;
  unknownExpiryGrams: string;
};

export type StockBatchPage = {
  items: StockBatch[];
  summary: BatchSummaryTotals;
  clinicDate: string;
  nextCursor: string | null;
};

export function listBotanicalItems(activeOnly = false, signal?: AbortSignal): Promise<BotanicalItemPage> {
  const query = activeOnly ? "?activeOnly=true&limit=100" : "?limit=100";
  return apiGet<BotanicalItemPage>(`/inventory/items${query}`, signal);
}

export function createBotanicalItem(code: string, displayName: string): Promise<BotanicalItem> {
  return apiMutation<BotanicalItem>("/inventory/items", { code, displayName }, "POST");
}

export function deactivateBotanicalItem(itemId: string, reason: string): Promise<BotanicalItem> {
  return apiMutation<BotanicalItem>(`/inventory/items/${encodeURIComponent(itemId)}/deactivate`, { reason }, "POST");
}

export function listStockBatches(eligibleOnly = false, itemId = "", signal?: AbortSignal): Promise<StockBatchPage> {
  const params = new URLSearchParams({ limit: "100" });
  if (eligibleOnly) params.set("eligibleOnly", "true");
  if (itemId) params.set("itemId", itemId);
  return apiGet<StockBatchPage>(`/inventory/batches?${params.toString()}`, signal);
}

export function receiveStockBatch(input: {
  itemId: string;
  batchReference: string;
  receivedGrams: string;
  expiresAt: string | null;
}): Promise<StockBatch> {
  return apiMutation<StockBatch>("/inventory/batches", input, "POST");
}

export function blockStockBatch(batchId: string, reason: string): Promise<StockBatch> {
  return apiMutation<StockBatch>(`/inventory/batches/${encodeURIComponent(batchId)}/block`, { reason }, "POST");
}
