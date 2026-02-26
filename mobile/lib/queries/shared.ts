/**
 * Re-exports of shared business logic from @aviary/shared.
 *
 * This file acts as a single seam — only this file needs updating
 * if the shared package structure changes.
 */

// Balance computation
export {
  buildRawDebts,
  simplifyDebts,
  getUserDebtCents,
  getUserBalanceCents,
  splitAmount,
  type ExpenseForDebt,
  type Debt,
} from "@aviary/shared";

// Formatting
export { formatCents, UNKNOWN_USER, formatDisplayName, toLocalDateString } from "@aviary/shared";

// Constants
export {
  MAX_GROUP_NAME,
  MAX_EXPENSE_DESCRIPTION,
  MAX_DISPLAY_NAME,
  MAX_EMAIL,
  MEMBER_EMOJIS,
} from "@aviary/shared";

// Amount utilities
export {
  MAX_AMOUNT_CENTS,
  MAX_AMOUNT_DOLLARS,
  stripAmountFormatting,
  formatAmountDisplay,
  filterAmountInput,
  filterDecimalInput,
} from "@aviary/shared";

// Percentage splits
export { percentagesToCents, centsToPercentages } from "@aviary/shared";

// Bird facts
export { BIRD_FACTS } from "@aviary/shared";

// Group colors
export { GROUP_COLORS, getGroupColor, type GroupColor } from "@aviary/shared";
