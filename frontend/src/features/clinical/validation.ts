const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const byteLength = (text: string) => new TextEncoder().encode(text).length;

export function validPatientId(value: string): boolean {
  return uuidPattern.test(value) && value.toLowerCase() !== "00000000-0000-0000-0000-000000000000";
}

export function validClinicalText(value: string): boolean {
  return value.trim().length > 0 && byteLength(value) <= 65_536;
}

export function validCorrectionReason(value: string): boolean {
  return value.trim().length > 0 && byteLength(value) <= 2_048;
}

export function formatColombo(value: string | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo",
  }).format(date);
}
