export type APIErrorBody = { error: { code: string; message: string } };

export class APIRequestError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "APIRequestError";
    this.status = status;
    this.code = code;
  }
}

export type StaffSession = { staffId: string; roles: string[]; csrfToken: string; expiresAt: string };
export const sessionExpiredEvent = "ayurflow:session-expired";

async function request<T>(resource: string, method: string, body?: unknown, csrf?: string, signal?: AbortSignal): Promise<T> {
  if (!resource.startsWith("/") || resource.startsWith("//") || resource.includes("..") || /[\\#\u0000-\u001f]/.test(resource)) {
    throw new Error("Use a relative API resource path.");
  }
  const response = await fetch(`/api/v1${resource}`, {
    method, credentials: "same-origin", cache: "no-store", signal,
    headers: { Accept: "application/json", ...(method !== "GET" && { "Content-Type": "application/json" }),
      ...(csrf && { "X-CSRF-Token": csrf }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    let code = "request_failed";
    try {
      const value = await response.json();
      if (typeof value?.error?.code === "string") code = value.error.code;
    } catch { /* A proxy may return a non-JSON error. */ }
    if (response.status === 401 && !resource.startsWith("/auth/") && typeof window !== "undefined") {
      window.dispatchEvent(new Event(sessionExpiredEvent));
    }
    throw new APIRequestError(response.status, code, "The request could not be completed.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function apiGet<T>(resource: string, signal?: AbortSignal): Promise<T> {
  return request<T>(resource, "GET", undefined, undefined, signal);
}

export function login(loginIdentifier: string, password: string): Promise<StaffSession> {
  return request<StaffSession>("/auth/login", "POST", { loginIdentifier, password });
}

// Session bootstrap rotates CSRF. Fetch immediately before a mutation; never retry
// a business write after an ambiguous network response.
export async function apiMutation<T>(resource: string, body?: unknown, method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST"): Promise<T> {
  try {
    const session = await apiGet<StaffSession>("/auth/session");
    return await request<T>(resource, method, body, session.csrfToken);
  } catch (error) {
    if (error instanceof APIRequestError && error.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event(sessionExpiredEvent));
    }
    throw error;
  }
}

export const staffAreas = [
  { href: "/patients", title: "Patient records", roles: ["receptionist"] },
  { href: "/clinical", title: "Clinical pathway", roles: ["clinician"] },
  { href: "/scheduling", title: "Scheduling", roles: ["receptionist", "therapist"] },
  { href: "/inventory", title: "Inventory", roles: ["dispensary"] },
  { href: "/billing", title: "Billing", roles: ["billing"] },
  { href: "/administration", title: "Staff administration", roles: ["administrator"] },
];

export function canOpenArea(path: string, roles: string[]): boolean {
  const area = staffAreas.find(area => path === area.href || path.startsWith(`${area.href}/`));
  return !area || area.roles.some(role => roles.includes(role));
}
