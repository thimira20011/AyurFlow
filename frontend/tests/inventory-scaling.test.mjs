import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatMilligramsToGrams,
  parseGramsToMilligrams,
  reconcileAllocations,
  scaleIngredientGrams,
} from "../src/features/inventory/scaling.ts";

test("parseGramsToMilligrams accepts valid fixed-precision positive grams and rejects invalid strings", () => {
  assert.equal(parseGramsToMilligrams("20"), 20000n);
  assert.equal(parseGramsToMilligrams("15.5"), 15500n);
  assert.equal(parseGramsToMilligrams("0.001"), 1n);
  assert.equal(parseGramsToMilligrams("0.000"), null);
  assert.equal(parseGramsToMilligrams("-5.000"), null);
  assert.equal(parseGramsToMilligrams("10.0001"), null);
  assert.equal(parseGramsToMilligrams("abc"), null);
  assert.equal(formatMilligramsToGrams(37500n), "37.500");
});

test("scaleIngredientGrams matches SRS PRE-02 / DEC03 Round Half Up fixtures", () => {
  // D-PRE-01 (AT09)
  assert.equal(scaleIngredientGrams("20.000", "250.000", "100.000"), "50.000");
  assert.equal(scaleIngredientGrams("15.000", "250.000", "100.000"), "37.500");
  // D-PRE-02 (DEC03 repeating decimal)
  assert.equal(scaleIngredientGrams("10.000", "100.000", "300.000"), "3.333");
  assert.equal(scaleIngredientGrams("20.000", "100.000", "300.000"), "6.667");
  // Exact 0.0005g tie rounds half up to 0.001g
  assert.equal(scaleIngredientGrams("1.000", "1.000", "2000.000"), "0.001");
  // Sub-milligram result rounding to 0.000g returns null
  assert.equal(scaleIngredientGrams("0.001", "0.001", "10.000"), null);
});

test("reconcileAllocations checks manual split-batch totals against snapshot requirements", () => {
  const snapshot = [
    { itemId: "item-ashwa", itemDisplayName: "Ashwagandha", requiredGrams: "50.000" },
    { itemId: "item-gudu", itemDisplayName: "Guduchi", requiredGrams: "37.500" },
  ];
  const batches = [
    { id: "batch-a1", itemId: "item-ashwa" },
    { id: "batch-a2", itemId: "item-ashwa" },
    { id: "batch-g1", itemId: "item-gudu" },
  ];

  // D-CON-01 split allocation: 30 + 20 = 50g Ashwagandha, 37.5g Guduchi -> matched
  const matched = reconcileAllocations(snapshot, [
    { batchId: "batch-a1", quantityGrams: "30.000" },
    { batchId: "batch-a2", quantityGrams: "20.000" },
    { batchId: "batch-g1", quantityGrams: "37.500" },
  ], batches);
  assert.deepEqual(matched.map((r) => [r.allocatedGrams, r.status, r.deltaGrams]), [
    ["50.000", "matched", "0.000"],
    ["37.500", "matched", "0.000"],
  ]);

  // Under and over allocation detection
  const mismatched = reconcileAllocations(snapshot, [
    { batchId: "batch-a1", quantityGrams: "30.000" },
    { batchId: "batch-g1", quantityGrams: "40.000" },
  ], batches);
  assert.deepEqual(mismatched.map((r) => [r.allocatedGrams, r.status, r.deltaGrams]), [
    ["30.000", "under", "20.000"],
    ["40.000", "over", "2.500"],
  ]);
});
