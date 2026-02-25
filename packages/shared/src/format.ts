/**
 * Formats an integer cents amount as a dollar string (e.g., 1234 → "$12.34").
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Fallback display name when a user record can't be resolved (deleted account, missing join, etc.) */
export const UNKNOWN_USER = "Unknown";
