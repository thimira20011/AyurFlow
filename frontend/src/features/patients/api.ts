import { APIRequestError, apiGet } from "@/lib/api-client";

export type IdentityType = "NIC" | "PASSPORT";

export type Patient = {
  id: string;
  displayName: string;
  phone: string | null;
  identity: { type: IdentityType; value: string } | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type StaffSession = {
  staffId: string;
  roles: string[];
  csrfToken: string;
  expiresAt: string;
};

export type PatientDraft = {
  displayName: string;
  phone: string | null;
  identity: Patient["identity"];
};

export type PatientChanges = {
  version: number;
  displayName?: string;
  phone?: string | null;
  identity?: Patient["identity"];
};

export async function getReceptionSession(): Promise<StaffSession> {
  const session = await apiGet<StaffSession>("/auth/session");
  if (!session.roles.includes("receptionist")) {
    throw new APIRequestError(403, "forbidden", "Patient demographics access is not available for this account.");
  }
  return session;
}

export async function searchPatients(query: string): Promise<Patient[]> {
  const response = await apiGet<{ items: Patient[] }>(`/patients?q=${encodeURIComponent(query)}`);
  return response.items;
}

export function getPatient(id: string): Promise<Patient> {
  return apiGet<Patient>(`/patients/${encodeURIComponent(id)}`);
}

export function registerPatient(input: PatientDraft): Promise<Patient> {
  return mutatePatient<Patient>("POST", "/patients", input);
}

export function updatePatient(id: string, input: PatientChanges): Promise<Patient> {
  return mutatePatient<Patient>("PATCH", `/patients/${encodeURIComponent(id)}`, input);
}

async function mutatePatient<T>(method: "POST" | "PATCH", resource: string, input: unknown): Promise<T> {
  // GET /auth/session rotates the CSRF token. Obtain it immediately before each
  // mutation and never persist it in browser storage or a shared module variable.
  const session = await getReceptionSession();
  const response = await fetch(`/api/v1${resource}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": session.csrfToken,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    let code = "request_failed";
    let message = "The request could not be completed.";
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // A proxy may return a non-JSON error. Keep the message generic.
    }
    throw new APIRequestError(response.status, code, message);
  }
  return (await response.json()) as T;
}
