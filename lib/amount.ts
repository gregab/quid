/** Maximum allowed expense/payment amount: $100,000 */
export const MAX_AMOUNT_DOLLARS = 100_000;
export const MAX_AMOUNT_CENTS = 10_000_000; // $100,000 in cents

/**
 * Strips comma formatting so a display value like "1,234.56" can be parsed.
 */
export function stripAmountFormatting(value: string): string {
  return value.replace(/,/g, "");
}

/**
 * Formats an amount string with commas and 2 decimal places for display.
 * "1234.5" → "1,234.50", "" → ""
 */
export function formatAmountDisplay(value: string): string {
  const stripped = value.replace(/,/g, "");
  if (stripped === "" || stripped === ".") return value;
  const num = parseFloat(stripped);
  if (isNaN(num)) return value;
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
