// Parse a rupee amount exactly into minor units. Reject excess precision.
export function parseLKRMinor(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const minor = Number(match[1] + (match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function toLKRInput(minor: number): string {
  const digits = String(minor).padStart(3, "0");
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
