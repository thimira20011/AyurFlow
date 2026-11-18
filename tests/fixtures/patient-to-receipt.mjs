import { readFileSync } from "node:fs";

function readFixture(file) {
  return JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
}

function byId(records, id) {
  const matching = records.filter(record => record.fixtureId === id);
  if (matching.length !== 1) throw new Error(`Expected one fixture for ${id}, found ${matching.length}`);
  return matching[0];
}

// Return fresh copies so one test can customize a case without affecting another.
export function loadPatientToReceipt() {
  const journey = readFixture("patient-to-receipt.json");
  const clinical = readFixture("member-b-cases.json");
  const inventory = readFixture("member-d-cases.json");
  const preparation = byId(inventory.scalingExamples, journey.preparationFixtureId);
  const recipe = byId(inventory.recipes, preparation.recipeFixtureId);
  const batchIds = new Set(inventory.consumptionExample.allocations.map(row => row.batchFixtureId));

  return {
    ...journey,
    patient: byId(clinical.patients, journey.patientFixtureId),
    pathway: clinical.pathwayExample,
    therapist: byId(clinical.actors, journey.session.therapistFixtureId),
    preparation,
    recipe: { ...recipe, code: journey.recipeCode },
    botanicalItems: recipe.ingredients.map(row => byId(inventory.botanicalItems, row.itemFixtureId)),
    stockBatches: [...batchIds].map(id => byId(inventory.stockBatches, id)),
    consumption: inventory.consumptionExample,
  };
}
