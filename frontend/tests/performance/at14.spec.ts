import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { expect, request, test, type APIRequestContext } from "@playwright/test";

const cache = "../.cache/auth-e2e";
const origin = "https://localhost:3443";
const durationMs = 600_000;
const intervalMs = 1_000;
const targetMs = 2_000;

type Check = { path: string; matches: (body: ResponseBody) => boolean };
type ResponseBody = {
  items?: { displayName?: string; roomId?: string; therapistId?: string; lineTotalMinor?: number }[];
  id?: string;
  status?: string;
  totalMinor?: number;
};
type Fixture = {
  patients: number;
  sessions: number;
  batches: number;
  invoices: string[];
  days: string[];
};

async function read(client: APIRequestContext, check: Check) {
  const response = await client.get(check.path, { timeout: 10_000, maxRedirects: 0 });
  try {
    if (response.status() !== 200) return `HTTP ${response.status()}`;
    return check.matches(await response.json()) ? undefined : "unexpected response";
  } finally {
    await response.dispose();
  }
}

test("AT14 baseline: five signed-in staff sustain ten minutes of synthetic reads", async () => {
  const { accounts, password } = JSON.parse(readFileSync(`${cache}/fixture.json`, "utf8")) as {
    accounts: Record<string, string>;
    password: string;
  };
  const fixture = JSON.parse(readFileSync(`${cache}/performance-fixture.json`, "utf8")) as Fixture;
  expect([fixture.patients, fixture.sessions, fixture.batches, fixture.invoices.length, fixture.days.length])
    .toEqual([500, 1_000, 200, 500, 10]);

  const operations = {
    patientSearch(index: number): Check {
      const name = `Synthetic AT14 Patient ${String(index % fixture.patients + 1).padStart(3, "0")}`;
      return {
        path: `/api/v1/patients?q=${encodeURIComponent(name)}`,
        matches: body => body.items?.length === 1 && body.items[0].displayName === name,
      };
    },
    availability(index: number): Check {
      const start = new Date(fixture.days[index % fixture.days.length]);
      const end = new Date(start.getTime() + 10 * 60 * 60_000);
      return {
        path: `/api/v1/availability?${new URLSearchParams({ start: start.toISOString(), end: end.toISOString() })}`,
        matches: body => body.items?.length === 2 &&
          body.items.some(item => !!item.roomId) && body.items.some(item => !!item.therapistId),
      };
    },
    invoiceRetrieval(index: number): Check {
      const id = fixture.invoices[index % fixture.invoices.length];
      return {
        path: `/api/v1/invoices/${id}`,
        matches: body => body.id === id && body.status === "issued" && body.totalMinor === 10_000 &&
          body.items?.length === 1 && body.items[0].lineTotalMinor === 10_000,
      };
    },
  };
  const staff = [
    { role: "receptionist", operation: "patientSearch" },
    { role: "receptionist_second", operation: "patientSearch" },
    { role: "therapist", operation: "availability" },
    { role: "billing", operation: "invoiceRetrieval" },
    { role: "billing_second", operation: "invoiceRetrieval" },
  ] as const;
  const samples = {
    patientSearch: { durations: [] as number[], errors: new Map<string, number>() },
    availability: { durations: [] as number[], errors: new Map<string, number>() },
    invoiceRetrieval: { durations: [] as number[], errors: new Map<string, number>() },
  };
  const clients: APIRequestContext[] = [];
  try {
    for (const { role, operation } of staff) {
      const client = await request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
      clients.push(client);
      const response = await client.post("/api/v1/auth/login", {
        headers: { Origin: origin },
        data: { loginIdentifier: accounts[role], password },
        timeout: 10_000,
      });
      const status = response.status();
      await response.dispose();
      expect(status, `${role} login`).toBe(200);
      expect(await read(client, operations[operation](0)), `${operation} fixture check`).toBeUndefined();
    }

    const startedAt = new Date().toISOString();
    const deadline = performance.now() + durationMs;
    await Promise.all(staff.map(async ({ operation }, worker) => {
      const sample = samples[operation];
      let index = worker * 67;
      while (performance.now() < deadline) {
        const started = performance.now();
        let error: string | undefined;
        try {
          error = await read(clients[worker], operations[operation](index++));
        } catch {
          error = "request or JSON read failed";
        }
        sample.durations.push(performance.now() - started);
        if (error) sample.errors.set(error, (sample.errors.get(error) ?? 0) + 1);
        const wait = Math.min(started + intervalMs, deadline) - performance.now();
        if (wait > 0) await delay(wait);
      }
    }));

    const results = Object.entries(samples).map(([operation, { durations, errors }]) => {
      durations.sort((a, b) => a - b);
      return {
        operation,
        requests: durations.length,
        errors: Object.fromEntries(errors),
        p95Ms: durations[Math.ceil(durations.length * 0.95) - 1],
      };
    });
    const evidence = {
      environment: "isolated synthetic fixture, HTTPS through Next.js to Go and PostgreSQL",
      commit: process.env.GITHUB_SHA,
      startedAt,
      durationMs,
      intervalMs,
      targetMs,
      staffSessions: staff.length,
      patients: fixture.patients,
      sessions: fixture.sessions,
      batches: fixture.batches,
      results,
    };
    const report = JSON.stringify(evidence, null, 2);
    writeFileSync(`${cache}/at14-results.json`, report + "\n");
    console.log(report);
    for (const result of results) {
      expect(Object.keys(result.errors), `${result.operation} errors`).toEqual([]);
      expect(result.p95Ms, `${result.operation} p95 in milliseconds`).toBeLessThan(targetMs);
    }
  } finally {
    await Promise.all(clients.map(client => client.dispose()));
  }
});
