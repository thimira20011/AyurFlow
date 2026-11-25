import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatMilligramsToGrams,
  parseGramsToMilligrams,
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
