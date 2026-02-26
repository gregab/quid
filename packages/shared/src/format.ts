/**
 * Formats an integer cents amount as a dollar string (e.g., 1234 → "$12.34").
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Fallback display name when a user record can't be resolved (deleted account, missing join, etc.) */
export const UNKNOWN_USER = "Unknown";

/**
 * Returns a YYYY-MM-DD string in the user's local timezone.
 * Unlike toISOString() which uses UTC, this uses local date components.
 */
export function toLocalDateString(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
