export function formatClinicDateTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo",
  }).format(new Date(isoTimestamp));
}

// Formatting only. Authoritative arithmetic uses integer minor units in Go/SQL.
export function formatLKR(minorUnits: number): string {
  if (!Number.isSafeInteger(minorUnits)) throw new Error("Expected safe integer minor units.");
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(minorUnits / 100);
}
