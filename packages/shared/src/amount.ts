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

/** Max digits before the decimal point (100000 = 6 digits). */
const MAX_INTEGER_DIGITS = MAX_AMOUNT_DOLLARS.toString().length; // 6

/**
 * Filters a dollar-amount input to only valid characters (digits, one dot,
 * commas) with max 2 decimal places and caps integer digits so the user
 * cannot type a number exceeding MAX_AMOUNT_DOLLARS.
 */
export function filterAmountInput(value: string): string {
  let filtered = "";
  let hasDot = false;
  let decimals = 0;
  let integerDigits = 0;
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") {
      if (hasDot) {
        if (decimals >= 2) continue;
        decimals++;
      } else {
        if (integerDigits >= MAX_INTEGER_DIGITS) continue;
        integerDigits++;
      }
      filtered += ch;
    } else if (ch === "." && !hasDot) {
      filtered += ch;
      hasDot = true;
    } else if (ch === ",") {
      filtered += ch;
    }
  }
  return filtered;
}

/**
 * Filters a plain decimal input (no commas) with max 2 decimal places
 * and caps integer digits to MAX_AMOUNT_DOLLARS.
 */
export function filterDecimalInput(value: string): string {
  let filtered = "";
  let hasDot = false;
  let decimals = 0;
  let integerDigits = 0;
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") {
      if (hasDot) {
        if (decimals >= 2) continue;
        decimals++;
      } else {
        if (integerDigits >= MAX_INTEGER_DIGITS) continue;
        integerDigits++;
      }
      filtered += ch;
    } else if (ch === "." && !hasDot) {
      filtered += ch;
      hasDot = true;
    }
  }
  return filtered;
}
