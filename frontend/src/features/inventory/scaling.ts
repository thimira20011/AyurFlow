const MAX_MILLIGRAMS = BigInt("999999999999");
const THOUSAND = BigInt(1000);
const ONE = BigInt(1);
const TWO = BigInt(2);
const GRAM_PATTERN = /^\d+(?:\.\d{1,3})?$/;

export function parseGramsToMilligrams(input: string): bigint | null {
  const trimmed = input.trim();
  if (!GRAM_PATTERN.test(trimmed)) {
    return null;
  }
  const [whole, frac = ""] = trimmed.split(".");
  const paddedFrac = frac.padEnd(3, "0");
  const milligrams = BigInt(whole) * THOUSAND + BigInt(paddedFrac);
  if (milligrams < ONE || milligrams > MAX_MILLIGRAMS) {
    return null;
  }
  return milligrams;
}

export function formatMilligramsToGrams(milligrams: bigint): string {
  const whole = milligrams / THOUSAND;
  const frac = (milligrams % THOUSAND).toString().padStart(3, "0");
  return `${whole.toString()}.${frac}`;
}

/**
 * Deterministic Round Half Up scaling at 0.001 g precision (SRS PRE-02, DEC03):
 * floor((2 * baseMg * targetMg + baseYieldMg) / (2 * baseYieldMg)).
 */
export function scaleIngredientGrams(
  baseQuantityGrams: string,
  targetYieldGrams: string,
  baseYieldGrams: string,
): string | null {
  const baseMg = parseGramsToMilligrams(baseQuantityGrams);
  const targetMg = parseGramsToMilligrams(targetYieldGrams);
  const yieldMg = parseGramsToMilligrams(baseYieldGrams);
  if (baseMg === null || targetMg === null || yieldMg === null) {
    return null;
  }
  const numerator = TWO * baseMg * targetMg + yieldMg;
  const denominator = TWO * yieldMg;
  const scaled = numerator / denominator;
  if (scaled < ONE || scaled > MAX_MILLIGRAMS) {
    return null;
  }
  return formatMilligramsToGrams(scaled);
}

export type AllocationReconciliation = {
  itemId: string;
  itemDisplayName: string;
  requiredGrams: string;
  allocatedGrams: string;
  deltaGrams: string;
  status: "matched" | "under" | "over";
};

/**
 * Reconciles manually selected batch allocations against saved preparation snapshot requirements
 * using exact BigInt milligrams (zero floating-point drift; no FEFO or auto-selection).
 */
export function reconcileAllocations(
  snapshot: { itemId: string; itemDisplayName: string; requiredGrams: string }[],
  allocations: { batchId: string; quantityGrams: string }[],
  batches: { id: string; itemId: string }[],
): AllocationReconciliation[] {
  const zero = BigInt(0);
  const batchItemById = new Map(batches.map((b) => [b.id, b.itemId]));
  const totalsByItem = new Map<string, bigint>();

  for (const row of allocations) {
    if (!row.batchId) continue;
    const itemId = batchItemById.get(row.batchId);
    const gramsMg = parseGramsToMilligrams(row.quantityGrams);
    if (!itemId || gramsMg === null) continue;
    totalsByItem.set(itemId, (totalsByItem.get(itemId) ?? zero) + gramsMg);
  }

  return snapshot.map((item) => {
    const requiredMg = parseGramsToMilligrams(item.requiredGrams) ?? zero;
    const allocatedMg = totalsByItem.get(item.itemId) ?? zero;
    const diff = requiredMg - allocatedMg;
    const status = diff === zero ? "matched" : diff > zero ? "under" : "over";
    const absDiff = diff < zero ? -diff : diff;
    return {
      itemId: item.itemId,
      itemDisplayName: item.itemDisplayName,
      requiredGrams: formatMilligramsToGrams(requiredMg),
      allocatedGrams: formatMilligramsToGrams(allocatedMg),
      deltaGrams: formatMilligramsToGrams(absDiff),
      status,
    };
  });
}
