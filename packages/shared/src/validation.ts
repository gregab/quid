import { z } from "zod";
import { MAX_GROUP_NAME, MAX_EXPENSE_DESCRIPTION, MAX_EMAIL, MAX_FEEDBACK_MESSAGE } from "./constants";
import { MAX_AMOUNT_CENTS } from "./amount";

// ── Reusable field validators ──────────────────────────────────────

const amountCents = z
  .number()
  .int()
  .positive("Amount must be greater than zero")
  .max(MAX_AMOUNT_CENTS, "Amount cannot exceed $1,000,000");

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

const customSplits = z.array(
  z.object({ userId: z.string().uuid(), amountCents: z.number().int().min(0) }),
);

// ── Expense schemas ────────────────────────────────────────────────

const expenseFields = {
  description: z.string().min(1).max(MAX_EXPENSE_DESCRIPTION),
  amountCents,
  date: dateString,
  paidById: z.string().uuid().optional(),
  participantIds: z.array(z.string().uuid()).min(1).optional(),
  splitType: z.enum(["equal", "custom"]).optional(),
  customSplits: customSplits.optional(),
};

export const createExpenseSchema = z.object({
  ...expenseFields,
  recurring: z
    .object({ frequency: z.enum(["weekly", "monthly", "yearly"]) })
    .optional(),
});

export const updateExpenseSchema = z.object(expenseFields);

// ── Payment schema ─────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  amountCents,
  date: dateString,
  paidById: z.string().uuid().optional(),
  recipientId: z.string().uuid(),
  settledUp: z.boolean().optional(),
});

// ── Friend expense schema ──────────────────────────────────────────

export const createFriendExpenseSchema = z.object({
  friendIds: z.array(z.string().uuid()).min(1, "Select at least one friend"),
  description: z.string().min(1).max(MAX_EXPENSE_DESCRIPTION),
  amountCents,
  date: dateString,
  paidById: z.string().uuid().optional(),
  splitType: z.enum(["equal", "custom"]).optional(),
  customSplits: customSplits.optional(),
});

// ── Group schemas ──────────────────────────────────────────────────

export const createGroupSchema = z.object({
  name: z.string().min(1).max(MAX_GROUP_NAME),
});

export const updateSettingsSchema = z.object({
  name: z.string().min(1).max(MAX_GROUP_NAME).optional(),
  bannerUrl: z.string().url().nullable().optional(),
});

// ── Member schema ──────────────────────────────────────────────────

export const addMemberSchema = z.object({
  email: z.string().email("Invalid email address").max(MAX_EMAIL),
});

// ── Feedback schema ────────────────────────────────────────────────

export const feedbackSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(MAX_FEEDBACK_MESSAGE, "Message is too long"),
  metadata: z
    .object({
      url: z.string().optional(),
      userAgent: z.string().optional(),
      screenWidth: z.number().optional(),
      screenHeight: z.number().optional(),
    })
    .optional(),
});
