// Balances
export { buildRawDebts, type ExpenseForDebt } from "./balances/buildRawDebts";
export { simplifyDebts, type Debt } from "./balances/simplify";
export { splitAmount } from "./balances/splitAmount";
export {
  getUserDebtCents,
  getUserBalanceCents,
} from "./balances/getUserDebt";

// Formatting
export { formatCents, UNKNOWN_USER } from "./format";
export { formatDisplayName } from "./formatDisplayName";

// Constants
export {
  MAX_GROUP_NAME,
  MAX_EXPENSE_DESCRIPTION,
  MAX_DISPLAY_NAME,
  MAX_EMAIL,
  MAX_FEEDBACK_MESSAGE,
  MEMBER_EMOJIS,
} from "./constants";

// Amount utilities
export {
  MAX_AMOUNT_DOLLARS,
  MAX_AMOUNT_CENTS,
  stripAmountFormatting,
  formatAmountDisplay,
  filterAmountInput,
  filterDecimalInput,
} from "./amount";

// Percentage split
export { percentagesToCents, centsToPercentages } from "./percentageSplit";

// Types
export type {
  ExpenseRow,
  ActivityLog,
  UserOwesDebt,
  SplitEntry,
  ResolvedDebt,
  GroupSummary,
} from "./types";

// Validation schemas
export {
  createExpenseSchema,
  updateExpenseSchema,
  createPaymentSchema,
  createGroupSchema,
  updateSettingsSchema,
  addMemberSchema,
  feedbackSchema,
} from "./validation";

// Activity diff
export {
  computeExpenseChanges,
  buildSplitSnapshot,
  type ExpenseChanges,
} from "./activityDiff";

// RPC param builders
export {
  buildCreateExpenseParams,
  buildCreateRecurringExpenseParams,
  buildUpdateExpenseParams,
  buildCreatePaymentParams,
  buildDeleteExpenseParams,
  type CreateExpenseInput,
  type CreateRecurringExpenseInput,
  type UpdateExpenseInput,
  type CreatePaymentInput,
  type DeleteExpenseInput,
} from "./rpcParams";

// Bird facts
export { BIRD_FACTS } from "./birdFacts";

// Group patterns
export {
  generateGroupPattern,
  generateGroupBanner,
  seedToBytes,
  resolvePatternDNA,
} from "./groupPattern";
