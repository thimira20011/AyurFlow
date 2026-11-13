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

export type RecipeIngredient = { itemId: string; itemCode: string; itemDisplayName: string; quantityGrams: string };
export type Recipe = { id: string; code: string; displayName: string; baseYieldGrams: string; version: number; active: boolean; ingredients: RecipeIngredient[] };
export type SnapshotItem = { itemId: string; itemCode: string; itemDisplayName: string; baseQuantityGrams: string; requiredGrams: string };
export type Consumption = { batchId: string; itemId: string; quantityGrams: string; confirmedAt: string };
export type Preparation = {
  id: string; patientId: string; sessionId: string; recipeId: string; recipeVersion: number; targetYieldGrams: string;
  status: "prepared" | "consumed"; preparedBy: string; preparedAt: string; consumedBy: string | null;
  consumedAt: string | null; operationId: string | null; snapshot: SnapshotItem[]; consumptions: Consumption[];
};
export type TraceRow = {
  patientId: string; patientDisplayName: string; sessionId: string; preparationId: string; batchId: string;
  batchReference: string; quantityGrams: string; confirmedBy: string; confirmedAt: string;
};
export type RecipeInput = { code: string; displayName: string; baseYieldGrams: string; ingredients: { itemId: string; quantityGrams: string }[]; version?: number };
export const listRecipes = () => apiGet<{ items: Recipe[] }>("/recipes");
export const createRecipe = (input: RecipeInput) => apiMutation<Recipe>("/recipes", input);
export const updateRecipe = (id: string, input: RecipeInput) => apiMutation<Recipe>(`/recipes/${encodeURIComponent(id)}`, input, "PATCH");
export const listPreparations = (patientId: string) => apiGet<{ items: Preparation[] }>(`/preparations?patientId=${encodeURIComponent(patientId)}`);
export const savePreparation = (input: { patientId: string; sessionId: string; recipeId: string; targetYieldGrams: string }) => apiMutation<Preparation>("/preparations", input);
export const confirmConsumption = (id: string, input: { operationId: string; allocations: { batchId: string; quantityGrams: string }[] }) =>
  apiMutation<Preparation>(`/preparations/${encodeURIComponent(id)}/confirm-consumption`, input);
export const traceBatch = (id: string) => apiGet<{ items: TraceRow[] }>(`/reports/inventory/traceability/batches/${encodeURIComponent(id)}`);
export const tracePatient = (id: string) => apiGet<{ items: TraceRow[] }>(`/reports/inventory/traceability/patients/${encodeURIComponent(id)}`);
