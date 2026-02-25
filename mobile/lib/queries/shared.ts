/**
 * Re-exports of shared business logic.
 *
 * Once @aviary/shared is built (Task #1), these should be replaced with
 * direct imports from @aviary/shared. For now, we import from the web
 * app's lib/ directory since the monorepo workspace makes them accessible.
 *
 * This file acts as a single seam — only this file needs updating when
 * the shared package is ready.
 */

// Balance computation
export { buildRawDebts } from "@aviary/shared/balances/buildRawDebts";
export type { ExpenseForDebt } from "@aviary/shared/balances/buildRawDebts";
export { simplifyDebts } from "@aviary/shared/balances/simplify";
export type { Debt } from "@aviary/shared/balances/simplify";
export {
  getUserDebtCents,
  getUserBalanceCents,
} from "@aviary/shared/balances/getUserDebt";
export { splitAmount } from "@aviary/shared/balances/splitAmount";

// Formatting
export { formatCents, UNKNOWN_USER } from "@aviary/shared/format";
export { formatDisplayName } from "@aviary/shared/formatDisplayName";

// Constants
export {
  MAX_GROUP_NAME,
  MAX_EXPENSE_DESCRIPTION,
  MAX_DISPLAY_NAME,
  MAX_EMAIL,
  MEMBER_EMOJIS,
} from "@aviary/shared/constants";

// Amount utilities
export {
  MAX_AMOUNT_CENTS,
  MAX_AMOUNT_DOLLARS,
  stripAmountFormatting,
  formatAmountDisplay,
  filterAmountInput,
  filterDecimalInput,
} from "@aviary/shared/amount";

// Percentage splits
export {
  percentagesToCents,
  centsToPercentages,
} from "@aviary/shared/percentageSplit";

// Bird facts (shared between web dashboard and mobile dashboard)
export { BIRD_FACTS } from "@aviary/shared/birdFacts";
