import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";

const origin = "https://localhost:3443";
const roles = ["administrator", "receptionist", "clinician", "therapist", "dispensary", "billing", "report_reader"] as const;
type Role = typeof roles[number];
type StaffFixture = { accounts: Record<Role, string>; password: string; prefix: string };

async function post(api: APIRequestContext, route: string, status: number, data?: object) {
  const session = await api.get("/api/v1/auth/session");
  expect(session.status(), "session refresh").toBe(200);
  const { csrfToken } = await session.json();
  const response = await api.post(`/api/v1${route}`, { headers: { Origin: origin, "X-CSRF-Token": csrfToken }, data });
  expect(response.status(), `POST ${route}`).toBe(status);
  return response.json();
}

async function get(api: APIRequestContext, route: string) {
  const response = await api.get(`/api/v1${route}`);
  expect(response.status(), `GET ${route}`).toBe(200);
  return response.json();
}

test("QA-03: one synthetic patient flows through clinical, delivery, stock and receipt", async ({ playwright }) => {
  const { loadPatientToReceipt } = await import("../../../tests/fixtures/patient-to-receipt.mjs");
  const fixture = JSON.parse(readFileSync("../.cache/auth-e2e/fixture.json", "utf8")) as StaffFixture;
  const journey = loadPatientToReceipt();
  const contexts = new Map<Role, APIRequestContext>();
  const staff = new Map<Role, string>();
  const api = (role: Role) => contexts.get(role)!;
  try {
    for (const role of roles) {
      const context = await playwright.request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
      contexts.set(role, context);
      const response = await context.post("/api/v1/auth/login", {
        headers: { Origin: origin }, data: { loginIdentifier: fixture.accounts[role], password: fixture.password },
      });
      expect(response.status(), `sign in as ${role}`).toBe(200);
      staff.set(role, (await response.json()).staffId);
    }

    const reception = api("receptionist");
    const doctor = api("clinician");
    const therapist = api("therapist");
    const dispenser = api("dispensary");
    const billing = api("billing");
    const reporter = api("report_reader");
    const { patient, plan, stage } = await test.step("register, assign, sign and approve the Preparatory stage", async () => {
      const { displayName, birthDate, gender, phone } = journey.patient;
      const patient = await post(reception, "/patients", 201, { displayName: `${displayName} ${fixture.prefix}`, birthDate, gender, phone });
      await post(api("administrator"), `/patients/${patient.id}/clinical-assignments`, 201, { clinicianId: staff.get("clinician") });
      const draft = await post(doctor, `/patients/${patient.id}/consultations`, 201, { draftText: journey.consultation.draftText });
      const signed = await post(doctor, `/consultations/${draft.id}/sign`, 200, { version: draft.version });
      expect(signed.status).toBe(journey.consultation.expectedStatus);
      expect((await api("administrator").get(`/api/v1/consultations/${draft.id}`)).status()).toBe(404);
      const plan = await post(doctor, `/patients/${patient.id}/plans`, 201, { sourceConsultationId: draft.id });
      const detail = await get(doctor, `/plans/${plan.id}`);
      const stage = detail.stages.find((entry: { ordinal: number }) => entry.ordinal === journey.plan.currentStage.ordinal);
      expect(stage.code).toBe(journey.plan.currentStage.label.toUpperCase());
      const started = await post(doctor, `/plans/${plan.id}/start`, 200, { version: plan.version });
      const approved = await post(doctor, `/plans/${plan.id}/stages/${stage.id}/approve`, 200, { version: started.version, confirmedChecks: stage.requiredChecks });
      expect(approved.status).toBe(journey.plan.expectedStatusAtBooking);
      const after = await get(doctor, `/plans/${plan.id}`);
      expect(after.stages.find((entry: { id: string }) => entry.id === stage.id).status).toBe(journey.plan.currentStage.expectedStatusAtBooking);
      return { patient, plan, stage };
    });

    const session = await test.step("book against both availability windows and complete delivery", async () => {
      const room = await post(reception, "/rooms", 201, { code: journey.room.code, name: journey.room.name });
      const therapistId = staff.get("therapist");
      // Move the fixture's whole schedule together to a future clinic day.
      const clinicTomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: journey.clinicTimeZone });
      const shift = (instant: string) => `${clinicTomorrow}${instant.slice(10)}`;
      const windowTimes = ({ startsAt, endsAt }: { startsAt: string; endsAt: string }) => ({ startsAt: shift(startsAt), endsAt: shift(endsAt) });
      const [roomWindow, therapistWindow] = journey.availability;
      await post(reception, "/availability", 201, { roomId: room.id, ...windowTimes(roomWindow) });
      await post(reception, "/availability", 201, { therapistId, ...windowTimes(therapistWindow) });
      const booked = await post(reception, "/sessions", 201, { patientId: patient.id, planId: plan.id, stageId: stage.id, roomId: room.id, therapistId, ...windowTimes(journey.session) });
      const started = await post(therapist, `/sessions/${booked.id}/start`, 200);
      const completed = await post(therapist, `/sessions/${booked.id}/complete`, 200, { observations: journey.session.observations });
      expect([booked.status, started.status, completed.status]).toEqual(journey.session.expectedStatuses);
      expect(completed.patientId).toBe(patient.id);
      return completed;
    });

    await test.step("save an undeducted snapshot, consume once, and trace both directions", async () => {
      const items = new Map<string, string>();
      for (const { fixtureId, code, displayName } of journey.botanicalItems) {
        items.set(fixtureId, (await post(dispenser, "/inventory/items", 201, { code, displayName })).id);
      }
      const batches = new Map<string, string>();
      const expiry = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
      for (const { fixtureId, itemFixtureId, batchReference, receivedGrams } of journey.stockBatches) {
        const batch = await post(dispenser, "/inventory/batches", 201, { itemId: items.get(itemFixtureId), batchReference, receivedGrams, expiresAt: expiry });
        batches.set(fixtureId, batch.id);
      }
      const { code, displayName, baseYieldGrams, ingredients } = journey.recipe;
      const recipe = await post(dispenser, "/recipes", 201, { code, displayName, baseYieldGrams,
        ingredients: ingredients.map(({ itemFixtureId, quantityGrams }: { itemFixtureId: string; quantityGrams: string }) => ({ itemId: items.get(itemFixtureId), quantityGrams })) });
      const prep = await post(dispenser, "/preparations", 201, { patientId: patient.id, sessionId: session.id, recipeId: recipe.id, targetYieldGrams: journey.preparation.targetYieldGrams });
      for (const { itemFixtureId, requiredGrams } of journey.preparation.expectedSnapshot) {
        expect(prep.snapshot).toContainEqual(expect.objectContaining({ itemId: items.get(itemFixtureId), requiredGrams }));
      }
      async function stock() {
        const result = await get(dispenser, "/inventory/batches?limit=100");
        return Object.fromEntries([...batches].map(([key, id]) => [key, result.items.find((item: { id: string }) => item.id === id)?.remainingGrams]));
      }
      expect(await stock()).toEqual(Object.fromEntries(journey.stockBatches.map(({ fixtureId, receivedGrams }: { fixtureId: string; receivedGrams: string }) => [fixtureId, receivedGrams])));
      expect((await get(reporter, `/reports/inventory/traceability/patients/${patient.id}`)).items ?? []).toEqual([]);
      const { operationId, allocations } = journey.consumption;
      const payload = { operationId, allocations: allocations.map(({ batchFixtureId, quantityGrams }: { batchFixtureId: string; quantityGrams: string }) => ({ batchId: batches.get(batchFixtureId), quantityGrams })) };
      const consumed = await post(dispenser, `/preparations/${prep.id}/confirm-consumption`, 200, payload);
      expect([prep.status, consumed.status]).toEqual(journey.expected.preparationStatuses);
      expect((await post(dispenser, `/preparations/${prep.id}/confirm-consumption`, 200, payload)).id).toBe(prep.id);
      expect(await stock()).toEqual(journey.expected.remainingGramsAfterConfirmation);
      const trace = await get(reporter, `/reports/inventory/traceability/patients/${patient.id}`);
      expect(trace.items).toHaveLength(payload.allocations.length);
      for (const allocation of payload.allocations) {
        const linked = expect.objectContaining({ ...allocation, patientId: patient.id, sessionId: session.id, preparationId: prep.id });
        expect(trace.items).toContainEqual(linked);
        const byBatch = await get(reporter, `/reports/inventory/traceability/batches/${allocation.batchId}`);
        expect(byBatch.items).toEqual([linked]);
      }
    });

    await test.step("issue the invoice, replay one deposit, and reconcile the report", async () => {
      const invoice = await post(billing, "/invoices", 201, { patientId: patient.patientCode });
      expect(invoice.patientId).toBe(patient.id);
      const path = `/invoices/${invoice.id}`;
      for (const line of journey.invoice.items) await post(billing, `${path}/items`, 201, line);
      const issued = await post(billing, `${path}/issue`, 200);
      expect(issued.status).toBe(journey.invoice.expectedStatus);
      for (const { operationId, amountMinor, paymentMethod, label } of journey.receipts) {
        const payload = { operationId, amountMinor, paymentMethod, label };
        const receipt = await post(billing, `${path}/receipts`, 201, payload);
        expect((await post(billing, `${path}/receipts`, 200, payload)).id).toBe(receipt.id);
      }
      expect((await get(billing, `${path}/receipts`)).items).toHaveLength(journey.receipts.length);
      const { invoiceTotalMinor, paidMinor, outstandingMinor } = journey.expected;
      const balance = { invoiceId: invoice.id, totalMinor: invoiceTotalMinor, paidMinor, outstandingMinor };
      expect(await get(billing, `${path}/balance`)).toMatchObject(balance);
      expect((await get(reporter, "/reports/billing/outstanding")).rows).toContainEqual(expect.objectContaining({ ...balance, patientId: patient.id }));
      expect((await reporter.get(`/api/v1${path}`)).status()).toBe(403);
    });
  } finally {
    await Promise.all([...contexts.values()].map(context => context.dispose()));
  }
});
