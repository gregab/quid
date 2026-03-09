import { describe, it, expect } from "vitest";
import {
  createExpenseSchema,
  updateExpenseSchema,
  createPaymentSchema,
  createFriendExpenseSchema,
  createGroupSchema,
  updateSettingsSchema,
  addMemberSchema,
  feedbackSchema,
  createGroupBillSchema,
  createGroupBillItemSchema,
  updateGroupBillItemSchema,
} from "./validation";

const uuid = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const uuid2 = "f1e2d3c4-b5a6-4789-9012-3456789abcde";

// ---------------------------------------------------------------------------
// createExpenseSchema
// ---------------------------------------------------------------------------

describe("createExpenseSchema", () => {
  const valid = {
    description: "Dinner",
    amountCents: 3000,
    date: "2026-03-01",
  };

  it("accepts minimal valid expense", () => {
    expect(createExpenseSchema.parse(valid)).toMatchObject(valid);
  });

  it("accepts all optional fields", () => {
    const full = {
      ...valid,
      paidById: uuid,
      participantIds: [uuid, uuid2],
      splitType: "custom" as const,
      customSplits: [
        { userId: uuid, amountCents: 2000 },
        { userId: uuid2, amountCents: 1000 },
      ],
      recurring: { frequency: "monthly" as const },
    };
    expect(createExpenseSchema.parse(full)).toMatchObject(full);
  });

  it("rejects empty description", () => {
    expect(() =>
      createExpenseSchema.parse({ ...valid, description: "" })
    ).toThrow();
  });

  it("rejects description exceeding max length", () => {
    expect(() =>
      createExpenseSchema.parse({ ...valid, description: "x".repeat(66) })
    ).toThrow();
  });

  it("rejects zero amount", () => {
    expect(() =>
      createExpenseSchema.parse({ ...valid, amountCents: 0 })
    ).toThrow();
  });

  it("rejects negative amount", () => {
    expect(() =>
      createExpenseSchema.parse({ ...valid, amountCents: -100 })
    ).toThrow();
  });

  it("rejects float amount", () => {
    expect(() =>
      createExpenseSchema.parse({ ...valid, amountCents: 30.5 })
    ).toThrow();
  });

  it("rejects amount over $100,000", () => {
    expect(() =>
      createExpenseSchema.parse({ ...valid, amountCents: 10_000_001 })
    ).toThrow();
  });

  it("accepts exactly $100,000", () => {
    expect(
      createExpenseSchema.parse({ ...valid, amountCents: 10_000_000 })
    ).toMatchObject({ amountCents: 10_000_000 });
  });

  it("rejects invalid date format", () => {
    expect(() =>
      createExpenseSchema.parse({ ...valid, date: "03/01/2026" })
    ).toThrow();
  });

  it("rejects invalid paidById (non-UUID)", () => {
    expect(() =>
      createExpenseSchema.parse({ ...valid, paidById: "not-a-uuid" })
    ).toThrow();
  });

  it("rejects invalid participantIds entries", () => {
    expect(() =>
      createExpenseSchema.parse({ ...valid, participantIds: ["bad"] })
    ).toThrow();
  });

  it("rejects invalid splitType", () => {
    expect(() =>
      createExpenseSchema.parse({ ...valid, splitType: "percentage" })
    ).toThrow();
  });

  it("accepts recurring with weekly frequency", () => {
    const result = createExpenseSchema.parse({
      ...valid,
      recurring: { frequency: "weekly" },
    });
    expect(result.recurring?.frequency).toBe("weekly");
  });

  it("accepts recurring with yearly frequency", () => {
    const result = createExpenseSchema.parse({
      ...valid,
      recurring: { frequency: "yearly" },
    });
    expect(result.recurring?.frequency).toBe("yearly");
  });

  it("rejects invalid recurring frequency", () => {
    expect(() =>
      createExpenseSchema.parse({
        ...valid,
        recurring: { frequency: "daily" },
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// updateExpenseSchema
// ---------------------------------------------------------------------------

describe("updateExpenseSchema", () => {
  it("accepts same shape as create (minus recurring)", () => {
    const result = updateExpenseSchema.parse({
      description: "Updated",
      amountCents: 5000,
      date: "2026-03-02",
    });
    expect(result.description).toBe("Updated");
  });

  it("rejects empty description", () => {
    expect(() =>
      updateExpenseSchema.parse({
        description: "",
        amountCents: 5000,
        date: "2026-03-02",
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// createPaymentSchema
// ---------------------------------------------------------------------------

describe("createPaymentSchema", () => {
  const valid = {
    amountCents: 5000,
    date: "2026-03-05",
    recipientId: uuid,
  };

  it("accepts minimal valid payment", () => {
    expect(createPaymentSchema.parse(valid)).toMatchObject(valid);
  });

  it("accepts optional paidById and settledUp", () => {
    const full = { ...valid, paidById: uuid2, settledUp: true };
    expect(createPaymentSchema.parse(full)).toMatchObject(full);
  });

  it("rejects missing recipientId", () => {
    expect(() =>
      createPaymentSchema.parse({ amountCents: 5000, date: "2026-03-05" })
    ).toThrow();
  });

  it("rejects non-UUID recipientId", () => {
    expect(() =>
      createPaymentSchema.parse({ ...valid, recipientId: "bob" })
    ).toThrow();
  });

  it("rejects zero amount", () => {
    expect(() =>
      createPaymentSchema.parse({ ...valid, amountCents: 0 })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// createFriendExpenseSchema
// ---------------------------------------------------------------------------

describe("createFriendExpenseSchema", () => {
  const valid = {
    friendIds: [uuid],
    description: "Lunch",
    amountCents: 2500,
    date: "2026-03-01",
  };

  it("accepts valid friend expense", () => {
    expect(createFriendExpenseSchema.parse(valid)).toMatchObject(valid);
  });

  it("rejects empty friendIds", () => {
    expect(() =>
      createFriendExpenseSchema.parse({ ...valid, friendIds: [] })
    ).toThrow();
  });

  it("rejects more than one friend", () => {
    expect(() =>
      createFriendExpenseSchema.parse({ ...valid, friendIds: [uuid, uuid2] })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// createGroupSchema
// ---------------------------------------------------------------------------

describe("createGroupSchema", () => {
  it("accepts valid group name", () => {
    expect(createGroupSchema.parse({ name: "Roommates" })).toEqual({
      name: "Roommates",
    });
  });

  it("rejects empty name", () => {
    expect(() => createGroupSchema.parse({ name: "" })).toThrow();
  });

  it("rejects name exceeding 40 chars", () => {
    expect(() =>
      createGroupSchema.parse({ name: "x".repeat(41) })
    ).toThrow();
  });

  it("accepts name at exactly 40 chars", () => {
    const name = "x".repeat(40);
    expect(createGroupSchema.parse({ name })).toEqual({ name });
  });
});

// ---------------------------------------------------------------------------
// updateSettingsSchema
// ---------------------------------------------------------------------------

describe("updateSettingsSchema", () => {
  it("accepts optional name", () => {
    expect(updateSettingsSchema.parse({ name: "New Name" })).toMatchObject({
      name: "New Name",
    });
  });

  it("accepts null bannerUrl (clear banner)", () => {
    expect(updateSettingsSchema.parse({ bannerUrl: null })).toMatchObject({
      bannerUrl: null,
    });
  });

  it("accepts valid bannerUrl", () => {
    expect(
      updateSettingsSchema.parse({ bannerUrl: "https://example.com/img.jpg" })
    ).toMatchObject({ bannerUrl: "https://example.com/img.jpg" });
  });

  it("rejects non-URL bannerUrl", () => {
    expect(() =>
      updateSettingsSchema.parse({ bannerUrl: "not-a-url" })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// addMemberSchema
// ---------------------------------------------------------------------------

describe("addMemberSchema", () => {
  it("accepts valid email", () => {
    expect(addMemberSchema.parse({ email: "test@example.com" })).toEqual({
      email: "test@example.com",
    });
  });

  it("rejects invalid email", () => {
    expect(() => addMemberSchema.parse({ email: "not-an-email" })).toThrow();
  });

  it("rejects email exceeding 254 chars", () => {
    const longEmail = "a".repeat(245) + "@test.com"; // 254 chars
    // Exactly 254 should be fine
    expect(() => addMemberSchema.parse({ email: longEmail })).not.toThrow();
    // 255 should fail
    const tooLong = "a".repeat(246) + "@test.com";
    expect(() => addMemberSchema.parse({ email: tooLong })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// feedbackSchema
// ---------------------------------------------------------------------------

describe("feedbackSchema", () => {
  it("accepts minimal feedback", () => {
    expect(feedbackSchema.parse({ message: "Great app!" })).toMatchObject({
      message: "Great app!",
    });
  });

  it("accepts feedback with metadata", () => {
    const result = feedbackSchema.parse({
      message: "Bug report",
      metadata: {
        url: "/dashboard",
        userAgent: "Mozilla/5.0",
        screenWidth: 1920,
        screenHeight: 1080,
      },
    });
    expect(result.metadata?.screenWidth).toBe(1920);
  });

  it("rejects empty message", () => {
    expect(() => feedbackSchema.parse({ message: "" })).toThrow();
  });

  it("rejects message over 5000 chars", () => {
    expect(() =>
      feedbackSchema.parse({ message: "x".repeat(5001) })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Group Bill schemas
// ---------------------------------------------------------------------------

describe("createGroupBillSchema", () => {
  it("accepts valid name", () => {
    expect(createGroupBillSchema.parse({ name: "Dinner bill" })).toEqual({
      name: "Dinner bill",
    });
  });

  it("rejects empty name", () => {
    expect(() => createGroupBillSchema.parse({ name: "" })).toThrow();
  });
});

describe("createGroupBillItemSchema", () => {
  it("accepts valid item", () => {
    const result = createGroupBillItemSchema.parse({
      description: "Burger",
      amountCents: 1500,
      isTaxOrTip: false,
      sortOrder: 0,
    });
    expect(result.description).toBe("Burger");
    expect(result.amountCents).toBe(1500);
  });

  it("defaults isTaxOrTip to false", () => {
    const result = createGroupBillItemSchema.parse({
      description: "Fries",
      amountCents: 500,
      sortOrder: 1,
    });
    expect(result.isTaxOrTip).toBe(false);
  });

  it("accepts zero amount (for items not yet priced)", () => {
    expect(() =>
      createGroupBillItemSchema.parse({
        description: "TBD",
        amountCents: 0,
        sortOrder: 0,
      })
    ).not.toThrow();
  });
});

describe("updateGroupBillItemSchema", () => {
  it("accepts partial update with just description", () => {
    expect(
      updateGroupBillItemSchema.parse({ description: "Updated item" })
    ).toMatchObject({ description: "Updated item" });
  });

  it("accepts toggle_claim action", () => {
    expect(
      updateGroupBillItemSchema.parse({ action: "toggle_claim" })
    ).toMatchObject({ action: "toggle_claim" });
  });

  it("accepts toggle_all action with include flag", () => {
    expect(
      updateGroupBillItemSchema.parse({ action: "toggle_all", include: true })
    ).toMatchObject({ action: "toggle_all", include: true });
  });

  it("rejects invalid action", () => {
    expect(() =>
      updateGroupBillItemSchema.parse({ action: "delete" })
    ).toThrow();
  });
});
