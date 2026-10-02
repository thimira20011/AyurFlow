export type APIErrorBody = { error: { code: string; message: string } };

export class APIRequestError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "APIRequestError";
  }
}

// Browser requests use the same-origin Next.js rewrite. Mutation helpers are added
// with the reviewed CSRF contract; do not use this helper to bypass that work.
export async function apiGet<T>(resource: string): Promise<T> {
  if (!resource.startsWith("/") || resource.startsWith("//") || resource.includes("..")) {
    throw new Error("Use a relative API resource path.");
  }
  const response = await fetch(`/api/v1${resource}`, {
    method: "GET", credentials: "same-origin", cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    let error: APIErrorBody = { error: { code: "request_failed", message: "The request could not be completed." } };
    try { error = (await response.json()) as APIErrorBody; } catch { /* A proxy may return a non-JSON error. */ }
    throw new APIRequestError(response.status, error.error.code, error.error.message);
  }
  return response.json() as Promise<T>;
}
