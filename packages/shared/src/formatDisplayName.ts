const MAX_LENGTH = 20;

/**
 * Abbreviates "First Last" style names to "First L." for compact display.
 * Names that don't look like auto-generated full names (e.g. single word,
 * lowercase, or already abbreviated) are returned as-is. Results are
 * capped at MAX_LENGTH characters.
 */
export function formatDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const parts = trimmed.split(/\s+/);
  let result = trimmed;

  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!;
    // Abbreviate only if the last word looks like a proper last name:
    // starts with uppercase, more than 1 char, not already abbreviated (e.g. "M.")
    if (last.length > 1 && !last.endsWith(".") && /^[A-Z]/.test(last)) {
      result = parts.slice(0, -1).join(" ") + " " + last[0] + ".";
    }
  }

  if (result.length > MAX_LENGTH) {
    return result.slice(0, MAX_LENGTH - 1) + "…";
  }
  return result;
}
