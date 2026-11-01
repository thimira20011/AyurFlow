import assert from "node:assert/strict";
import { test } from "node:test";
import { validPatientId, validClinicalText, validCorrectionReason, formatColombo } from "../src/features/clinical/validation.ts";

test("clinical field limits preserve Unicode and reject blanks", () => {
  assert.equal(validClinicalText("සිංහල synthetic note"), true);
  assert.equal(validClinicalText(" \n "), false);
  assert.equal(validClinicalText("x".repeat(65_537)), false);
  assert.equal(validCorrectionReason("පැහැදිලි කිරීම"), true);
  assert.equal(validCorrectionReason(" "), false);
  assert.equal(validCorrectionReason("x".repeat(2_049)), false);
});

test("patient IDs and displayed instants are bounded", () => {
  assert.equal(validPatientId("00000000-0000-4000-8000-000000000101"), true);
  assert.equal(validPatientId("00000000-0000-0000-0000-000000000000"), false);
  assert.equal(validPatientId("not-an-id"), false);
  assert.match(formatColombo("2026-10-20T09:00:00Z"), /(?:20 Oct|Oct 20).*2026.*2:30/);
  assert.equal(formatColombo("invalid"), "Date unavailable");
});
