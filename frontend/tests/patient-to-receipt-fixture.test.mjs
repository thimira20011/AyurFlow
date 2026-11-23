import assert from "node:assert/strict";
import test from "node:test";
import { loadPatientToReceipt } from "../../tests/fixtures/patient-to-receipt.mjs";

function milligrams(grams) {
  assert.match(grams, /^\d+\.\d{3}$/);
  return BigInt(grams.replace(".", ""));
}

test("QA-01 links the patient, plan, approved stage and scheduled delivery", () => {
  const { patient, consultation, plan, pathway, session, room, therapist, availability, preparation, invoice,
    clinicTimeZone, referenceClinicDate } = loadPatientToReceipt();

  for (const record of [consultation, plan, session, preparation, invoice]) {
    assert.equal(record.patientFixtureId, patient.fixtureId);
  }
  assert.equal(consultation.expectedStatus, "signed");
  assert.equal(session.planFixtureId, plan.fixtureId);
  assert.equal(session.stageFixtureId, plan.currentStage.fixtureId);
  assert.equal(plan.currentStage.label, pathway.stages[plan.currentStage.ordinal - 1].label);
  assert.equal(plan.expectedStatusAtBooking, "active");
  assert.equal(plan.currentStage.expectedStatusAtBooking, "approved");
  assert.equal(session.roomFixtureId, room.fixtureId);
  assert.equal(therapist.role, "therapist");
  assert.equal(preparation.sessionFixtureId, session.fixtureId);
  assert.deepEqual(session.expectedStatuses, ["booked", "in_progress", "completed"]);

  const starts = Date.parse(session.startsAt);
  const ends = Date.parse(session.endsAt);
  assert.ok(starts < ends);
  const clinicDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: clinicTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(starts));
  assert.equal(clinicDate, referenceClinicDate);
  for (const [field, id] of [["roomFixtureId", room.fixtureId], ["therapistFixtureId", therapist.fixtureId]]) {
    const window = availability.find(row => row[field] === id);
    assert.ok(window, `Missing availability for ${id}`);
    assert.ok(Date.parse(window.startsAt) <= starts && Date.parse(window.endsAt) >= ends);
  }
});

test("QA-01 recipe snapshot and actual consumption reconcile with exact stock quantities", () => {
  const { preparation, recipe, botanicalItems, stockBatches, consumption, expected, referenceClinicDate } = loadPatientToReceipt();
  assert.equal(consumption.preparationFixtureId, preparation.fixtureId);
  assert.ok(recipe.code.trim());
  assert.deepEqual(expected.preparationStatuses, ["prepared", "consumed"]);
  assert.equal(expected.stockAfterPreparationSave, "unchanged");

  const allocatedByItem = new Map();
  assert.equal(stockBatches.length, consumption.allocations.length, "Use one allocation per batch");
  for (const allocation of consumption.allocations) {
    const batch = stockBatches.find(row => row.fixtureId === allocation.batchFixtureId);
    assert.ok(batch, `Missing batch ${allocation.batchFixtureId}`);
    assert.equal(batch.itemFixtureId, allocation.itemFixtureId);
    assert.ok(!batch.blocked && batch.expiresAt >= referenceClinicDate);
    const quantity = milligrams(allocation.quantityGrams);
    const remaining = milligrams(batch.remainingGrams) - quantity;
    assert.ok(quantity > 0n && remaining >= 0n);
    assert.equal(remaining, milligrams(expected.remainingGramsAfterConfirmation[batch.fixtureId]));
    allocatedByItem.set(batch.itemFixtureId, (allocatedByItem.get(batch.itemFixtureId) ?? 0n) + quantity);
  }
  const itemIds = botanicalItems.map(row => row.fixtureId).sort();
  assert.deepEqual([...allocatedByItem.keys()].sort(), itemIds);
  assert.deepEqual(preparation.expectedSnapshot.map(row => row.itemFixtureId).sort(), itemIds);
  for (const ingredient of recipe.ingredients) {
    const numerator = milligrams(ingredient.quantityGrams) * milligrams(preparation.targetYieldGrams);
    const denominator = milligrams(recipe.baseYieldGrams);
    const scaled = (numerator + denominator / 2n) / denominator;
    const snapshot = preparation.expectedSnapshot.find(row => row.itemFixtureId === ingredient.itemFixtureId);
    assert.equal(milligrams(snapshot.requiredGrams), scaled);
    assert.equal(allocatedByItem.get(ingredient.itemFixtureId), scaled);
  }
});

test("QA-01 receipts belong to the issued invoice and preserve its expected balance", () => {
  const { invoice, receipts, consumption, expected } = loadPatientToReceipt();
  assert.ok(invoice.items.length > 0 && receipts.length > 0);
  for (const item of invoice.items) {
    assert.ok(Number.isSafeInteger(item.quantity) && item.quantity > 0);
    assert.ok(Number.isSafeInteger(item.unitPriceMinor) && item.unitPriceMinor >= 0);
  }
  const total = invoice.items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0);
  assert.ok(Number.isSafeInteger(total) && total > 0);
  assert.equal(invoice.expectedStatus, "issued");
  assert.equal(total, expected.invoiceTotalMinor);
  const operations = new Set();
  for (const operationId of [consumption.operationId, ...receipts.map(row => row.operationId)]) {
    assert.match(operationId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.ok(!operations.has(operationId), "Use different operation IDs for different mutations");
    operations.add(operationId);
  }
  let paid = 0;
  for (const receipt of receipts) {
    assert.equal(receipt.invoiceFixtureId, invoice.fixtureId);
    assert.ok(Number.isSafeInteger(receipt.amountMinor) && receipt.amountMinor > 0);
    assert.equal(receipt.paymentMethod, "direct_deposit");
    assert.ok(receipt.label.trim());
    paid += receipt.amountMinor;
    assert.ok(paid <= total);
  }
  assert.equal(paid, expected.paidMinor);
  assert.equal(total - paid, expected.outstandingMinor);
});
