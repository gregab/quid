import { describe, it, expect } from "vitest";
import {
  buildCreateExpenseParams,
  buildCreateRecurringExpenseParams,
  buildUpdateExpenseParams,
  buildCreatePaymentParams,
  buildDeleteExpenseParams,
} from "./rpcParams";
import type {
  CreateExpenseInput,
  CreateRecurringExpenseInput,
  UpdateExpenseInput,
  CreatePaymentInput,
  DeleteExpenseInput,
} from "./rpcParams";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const alice = { userId: "aaa-111", displayName: "Alice Smith" };
const bob = { userId: "bbb-222", displayName: "Bob Jones" };
const carol = { userId: "ccc-333", displayName: "Carol Lee" };
const members = [alice, bob, carol];

// ---------------------------------------------------------------------------
// buildCreateExpenseParams
// ---------------------------------------------------------------------------

describe("buildCreateExpenseParams", () => {
  const base: CreateExpenseInput = {
    groupId: "group-1",
    description: "Dinner",
    amountCents: 6000,
    date: "2026-03-01",
    paidById: alice.userId,
    participantIds: [alice.userId, bob.userId, carol.userId],
    members,
    splitType: "equal",
    participantDisplayNames: ["Alice Smith", "Bob Jones", "Carol Lee"],
  };

  it("maps all fields to underscore-prefixed RPC params", () => {
    const result = buildCreateExpenseParams(base);
    expect(result).toEqual({
      _group_id: "group-1",
      _description: "Dinner",
      _amount_cents: 6000,
      _date: "2026-03-01",
      _paid_by_id: alice.userId,
      _participant_ids: [alice.userId, bob.userId, carol.userId],
      _paid_by_display_name: "Alice Smith",
      _split_type: "equal",
      _split_amounts: undefined,
      _participant_display_names: ["Alice Smith", "Bob Jones", "Carol Lee"],
    });
  });

  it("resolves paidBy display name from members list", () => {
    const result = buildCreateExpenseParams({ ...base, paidById: bob.userId });
    expect(result._paid_by_display_name).toBe("Bob Jones");
  });

  it("falls back to 'Unknown' when paidById is not in members", () => {
    const result = buildCreateExpenseParams({
      ...base,
      paidById: "nonexistent-user",
    });
    expect(result._paid_by_display_name).toBe("Unknown");
  });

  it("passes split_amounts for custom splits", () => {
    const result = buildCreateExpenseParams({
      ...base,
      splitType: "custom",
      splitAmounts: [3000, 2000, 1000],
    });
    expect(result._split_type).toBe("custom");
    expect(result._split_amounts).toEqual([3000, 2000, 1000]);
  });

  it("converts null splitAmounts to undefined", () => {
    const result = buildCreateExpenseParams({
      ...base,
      splitAmounts: null,
    });
    expect(result._split_amounts).toBeUndefined();
  });

  it("handles single participant", () => {
    const result = buildCreateExpenseParams({
      ...base,
      participantIds: [alice.userId],
      participantDisplayNames: ["Alice Smith"],
    });
    expect(result._participant_ids).toEqual([alice.userId]);
    expect(result._participant_display_names).toEqual(["Alice Smith"]);
  });

  it("handles large amounts (integer cents)", () => {
    const result = buildCreateExpenseParams({
      ...base,
      amountCents: 99999999,
    });
    expect(result._amount_cents).toBe(99999999);
  });
});

// ---------------------------------------------------------------------------
// buildCreateRecurringExpenseParams
// ---------------------------------------------------------------------------

describe("buildCreateRecurringExpenseParams", () => {
  const base: CreateRecurringExpenseInput = {
    groupId: "group-1",
    description: "Netflix",
    amountCents: 1599,
    date: "2026-03-01",
    paidById: alice.userId,
    participantIds: [alice.userId, bob.userId],
    members,
    splitType: "equal",
    participantDisplayNames: ["Alice Smith", "Bob Jones"],
    frequency: "monthly",
  };

  it("includes all create params plus _frequency", () => {
    const result = buildCreateRecurringExpenseParams(base);
    expect(result._frequency).toBe("monthly");
    expect(result._group_id).toBe("group-1");
    expect(result._description).toBe("Netflix");
    expect(result._amount_cents).toBe(1599);
    expect(result._paid_by_display_name).toBe("Alice Smith");
  });

  it("supports weekly frequency", () => {
    const result = buildCreateRecurringExpenseParams({
      ...base,
      frequency: "weekly",
    });
    expect(result._frequency).toBe("weekly");
  });

  it("supports yearly frequency", () => {
    const result = buildCreateRecurringExpenseParams({
      ...base,
      frequency: "yearly",
    });
    expect(result._frequency).toBe("yearly");
  });
});

// ---------------------------------------------------------------------------
// buildUpdateExpenseParams
// ---------------------------------------------------------------------------

describe("buildUpdateExpenseParams", () => {
  const base: UpdateExpenseInput = {
    expenseId: "exp-1",
    groupId: "group-1",
    description: "Updated dinner",
    amountCents: 7500,
    date: "2026-03-02",
    paidById: bob.userId,
    participantIds: [alice.userId, bob.userId],
    members,
    splitType: "equal",
    changes: { description: { from: "Dinner", to: "Updated dinner" } },
    splitsBefore: [
      { displayName: "Alice Smith", amountCents: 2000 },
      { displayName: "Bob Jones", amountCents: 2000 },
      { displayName: "Carol Lee", amountCents: 2000 },
    ],
    splitsAfter: [
      { displayName: "Alice Smith", amountCents: 3750 },
      { displayName: "Bob Jones", amountCents: 3750 },
    ],
  };

  it("maps all fields including expense_id and change metadata", () => {
    const result = buildUpdateExpenseParams(base);
    expect(result).toEqual({
      _expense_id: "exp-1",
      _group_id: "group-1",
      _description: "Updated dinner",
      _amount_cents: 7500,
      _date: "2026-03-02",
      _paid_by_id: bob.userId,
      _participant_ids: [alice.userId, bob.userId],
      _paid_by_display_name: "Bob Jones",
      _changes: { description: { from: "Dinner", to: "Updated dinner" } },
      _split_type: "equal",
      _split_amounts: undefined,
      _splits_before: base.splitsBefore,
      _splits_after: base.splitsAfter,
    });
  });

  it("resolves paidBy from members", () => {
    const result = buildUpdateExpenseParams({
      ...base,
      paidById: carol.userId,
    });
    expect(result._paid_by_display_name).toBe("Carol Lee");
  });

  it("falls back to Unknown for missing paidById", () => {
    const result = buildUpdateExpenseParams({
      ...base,
      paidById: "deleted-user",
    });
    expect(result._paid_by_display_name).toBe("Unknown");
  });

  it("passes custom split amounts when provided", () => {
    const result = buildUpdateExpenseParams({
      ...base,
      splitType: "custom",
      splitAmounts: [5000, 2500],
    });
    expect(result._split_type).toBe("custom");
    expect(result._split_amounts).toEqual([5000, 2500]);
  });
});

// ---------------------------------------------------------------------------
// buildCreatePaymentParams
// ---------------------------------------------------------------------------

describe("buildCreatePaymentParams", () => {
  const base: CreatePaymentInput = {
    groupId: "group-1",
    amountCents: 5000,
    date: "2026-03-05",
    paidById: alice.userId,
    recipientId: bob.userId,
    members,
  };

  it("maps payment fields with display names for both parties", () => {
    const result = buildCreatePaymentParams(base);
    expect(result).toEqual({
      _group_id: "group-1",
      _amount_cents: 5000,
      _date: "2026-03-05",
      _paid_by_id: alice.userId,
      _recipient_id: bob.userId,
      _from_display_name: "Alice Smith",
      _to_display_name: "Bob Jones",
      _settled_up: false,
    });
  });

  it("defaults settledUp to false", () => {
    const result = buildCreatePaymentParams(base);
    expect(result._settled_up).toBe(false);
  });

  it("respects explicit settledUp = true", () => {
    const result = buildCreatePaymentParams({ ...base, settledUp: true });
    expect(result._settled_up).toBe(true);
  });

  it("falls back to Unknown for unknown paidById", () => {
    const result = buildCreatePaymentParams({
      ...base,
      paidById: "unknown-user",
    });
    expect(result._from_display_name).toBe("Unknown");
  });

  it("falls back to Unknown for unknown recipientId", () => {
    const result = buildCreatePaymentParams({
      ...base,
      recipientId: "unknown-user",
    });
    expect(result._to_display_name).toBe("Unknown");
  });

  it("handles both parties unknown", () => {
    const result = buildCreatePaymentParams({
      ...base,
      paidById: "x",
      recipientId: "y",
      members: [],
    });
    expect(result._from_display_name).toBe("Unknown");
    expect(result._to_display_name).toBe("Unknown");
  });
});

// ---------------------------------------------------------------------------
// buildDeleteExpenseParams
// ---------------------------------------------------------------------------

describe("buildDeleteExpenseParams", () => {
  const base: DeleteExpenseInput = {
    expenseId: "exp-99",
    groupId: "group-1",
    description: "Old dinner",
    amountCents: 4000,
    paidByDisplayName: "Alice Smith",
    date: "2026-02-15",
    participantDisplayNames: ["Alice Smith", "Bob Jones"],
  };

  it("maps all fields for delete RPC", () => {
    const result = buildDeleteExpenseParams(base);
    expect(result).toEqual({
      _expense_id: "exp-99",
      _group_id: "group-1",
      _description: "Old dinner",
      _amount_cents: 4000,
      _paid_by_display_name: "Alice Smith",
      _date: "2026-02-15",
      _participant_display_names: ["Alice Smith", "Bob Jones"],
    });
  });

  it("handles missing participantDisplayNames (undefined)", () => {
    const { participantDisplayNames: _, ...rest } = base;
    const result = buildDeleteExpenseParams(rest as DeleteExpenseInput);
    expect(result._participant_display_names).toBeUndefined();
  });

  it("handles empty participant list", () => {
    const result = buildDeleteExpenseParams({
      ...base,
      participantDisplayNames: [],
    });
    expect(result._participant_display_names).toEqual([]);
  });
});
