import { describe, it, expect } from "vitest";
import { computeBillSplits, type GroupBillItem } from "./groupBills";

// Helper to build a GroupBillItem with defaults
function makeItem(
  overrides: Partial<GroupBillItem> & {
    amountCents: number;
    claimedByUserIds: string[];
  }
): GroupBillItem {
  return {
    id: "item-" + Math.random().toString(36).slice(2),
    groupBillId: "bill-1",
    description: "Test item",
    isTaxOrTip: false,
    sortOrder: 0,
    ...overrides,
  };
}

describe("computeBillSplits", () => {
  describe("simple cases", () => {
    it("returns empty array for no items", () => {
      expect(computeBillSplits([])).toEqual([]);
    });

    it("single person claims a single item — owes the full amount", () => {
      const items = [
        makeItem({ amountCents: 1000, claimedByUserIds: ["user-a"] }),
      ];
      const result = computeBillSplits(items);
      expect(result).toEqual([{ userId: "user-a", amountCents: 1000 }]);
    });

    it("two people, one item each", () => {
      const items = [
        makeItem({ amountCents: 500, claimedByUserIds: ["user-a"] }),
        makeItem({ amountCents: 800, claimedByUserIds: ["user-b"] }),
      ];
      const result = computeBillSplits(items);
      expect(result).toEqual([
        { userId: "user-a", amountCents: 500 },
        { userId: "user-b", amountCents: 800 },
      ]);
    });

    it("two people share an item evenly", () => {
      const items = [
        makeItem({ amountCents: 1000, claimedByUserIds: ["user-a", "user-b"] }),
      ];
      const result = computeBillSplits(items);
      expect(result).toEqual([
        { userId: "user-a", amountCents: 500 },
        { userId: "user-b", amountCents: 500 },
      ]);
    });
  });

  describe("rounding with remainders", () => {
    it("3 people share $10 — remainder goes to first claimer", () => {
      // $10 / 3 = $3.33... → floor = 333 cents each, remainder 1 cent to first
      const items = [
        makeItem({
          amountCents: 1000,
          claimedByUserIds: ["user-a", "user-b", "user-c"],
        }),
      ];
      const result = computeBillSplits(items);

      // Total must equal 1000
      const total = result.reduce((s, r) => s + r.amountCents, 0);
      expect(total).toBe(1000);

      const aShare = result.find((r) => r.userId === "user-a")?.amountCents;
      const bShare = result.find((r) => r.userId === "user-b")?.amountCents;
      const cShare = result.find((r) => r.userId === "user-c")?.amountCents;

      // floor(1000/3) = 333; remainder = 1 → first claimer gets 334
      expect(aShare).toBe(334);
      expect(bShare).toBe(333);
      expect(cShare).toBe(333);
    });

    it("3 people share $7 — remainder distributed correctly", () => {
      // 700 / 3 = 233 remainder 1
      const items = [
        makeItem({
          amountCents: 700,
          claimedByUserIds: ["user-a", "user-b", "user-c"],
        }),
      ];
      const result = computeBillSplits(items);
      const total = result.reduce((s, r) => s + r.amountCents, 0);
      expect(total).toBe(700);

      const aShare = result.find((r) => r.userId === "user-a")?.amountCents;
      expect(aShare).toBe(234); // gets the +1 remainder
    });
  });

  describe("unclaimed items", () => {
    it("skips items with empty claimedByUserIds", () => {
      const items = [
        makeItem({ amountCents: 500, claimedByUserIds: ["user-a"] }),
        makeItem({ amountCents: 999, claimedByUserIds: [] }), // unclaimed
      ];
      const result = computeBillSplits(items);
      expect(result).toEqual([{ userId: "user-a", amountCents: 500 }]);
    });

    it("returns empty array when all items are unclaimed", () => {
      const items = [
        makeItem({ amountCents: 500, claimedByUserIds: [] }),
        makeItem({ amountCents: 300, claimedByUserIds: [] }),
      ];
      expect(computeBillSplits(items)).toEqual([]);
    });
  });

  describe("tax/tip distribution", () => {
    it("distributes tax proportionally based on subtotals", () => {
      // user-a ordered $20, user-b ordered $10, tax = $3
      // user-a gets floor(300 * 2000 / 3000) = floor(200) = 200
      // user-b gets floor(300 * 1000 / 3000) = floor(100) = 100
      // total tax distributed = 300, remainder = 0
      const items = [
        makeItem({ amountCents: 2000, claimedByUserIds: ["user-a"] }),
        makeItem({ amountCents: 1000, claimedByUserIds: ["user-b"] }),
        makeItem({
          amountCents: 300,
          claimedByUserIds: [],
          isTaxOrTip: true,
        }),
      ];
      const result = computeBillSplits(items);

      const aAmount = result.find((r) => r.userId === "user-a")?.amountCents;
      const bAmount = result.find((r) => r.userId === "user-b")?.amountCents;

      expect(aAmount).toBe(2200);
      expect(bAmount).toBe(1100);
      expect(result.reduce((s, r) => s + r.amountCents, 0)).toBe(3300);
    });

    it("restaurant scenario: items + tip with rounding", () => {
      // user-a: $15, user-b: $12, user-c: $9 → total $36
      // tip: $6 (=600 cents)
      // user-a gets floor(600 * 1500 / 3600) = floor(250) = 250
      // user-b gets floor(600 * 1200 / 3600) = floor(200) = 200
      // user-c gets floor(600 * 900 / 3600)  = floor(150) = 150
      // distributed = 600, remainder = 0 → no adjustment needed
      const items = [
        makeItem({ amountCents: 1500, claimedByUserIds: ["user-a"] }),
        makeItem({ amountCents: 1200, claimedByUserIds: ["user-b"] }),
        makeItem({ amountCents: 900, claimedByUserIds: ["user-c"] }),
        makeItem({
          amountCents: 600,
          claimedByUserIds: [],
          isTaxOrTip: true,
        }),
      ];
      const result = computeBillSplits(items);

      const total = result.reduce((s, r) => s + r.amountCents, 0);
      expect(total).toBe(4200); // 3600 + 600

      const aAmount = result.find((r) => r.userId === "user-a")?.amountCents;
      const bAmount = result.find((r) => r.userId === "user-b")?.amountCents;
      const cAmount = result.find((r) => r.userId === "user-c")?.amountCents;

      expect(aAmount).toBe(1750); // 1500 + 250
      expect(bAmount).toBe(1400); // 1200 + 200
      expect(cAmount).toBe(1050); // 900 + 150
    });

    it("tax remainder goes to person with highest subtotal", () => {
      // user-a: $10, user-b: $10 → equal subtotals, tax = $1 (odd cents)
      // floor(100 * 1000 / 2000) = 50 each, distributed = 100, remainder = 0
      // Test a case where there IS a remainder
      // user-a: $200, user-b: $100, tax = $1 (100 cents)
      // user-a: floor(100 * 200 / 300) = floor(66.67) = 66
      // user-b: floor(100 * 100 / 300) = floor(33.33) = 33
      // distributed = 99, remainder = 1 → goes to user-a (highest subtotal)
      const items = [
        makeItem({ amountCents: 200, claimedByUserIds: ["user-a"] }),
        makeItem({ amountCents: 100, claimedByUserIds: ["user-b"] }),
        makeItem({
          amountCents: 100,
          claimedByUserIds: [],
          isTaxOrTip: true,
        }),
      ];
      const result = computeBillSplits(items);

      const total = result.reduce((s, r) => s + r.amountCents, 0);
      expect(total).toBe(400); // 300 + 100

      const aAmount = result.find((r) => r.userId === "user-a")?.amountCents;
      const bAmount = result.find((r) => r.userId === "user-b")?.amountCents;

      expect(aAmount).toBe(267); // 200 + 66 + 1 remainder
      expect(bAmount).toBe(133); // 100 + 33
    });

    it("only tax/tip items with no claimed regular items — everyone owes nothing", () => {
      const items = [
        makeItem({
          amountCents: 500,
          claimedByUserIds: [],
          isTaxOrTip: true,
        }),
      ];
      expect(computeBillSplits(items)).toEqual([]);
    });

    it("tax/tip skipped when total subtotal is zero due to no claims", () => {
      // A regular unclaimed item + a tax item → nothing owed by anyone
      const items = [
        makeItem({ amountCents: 1000, claimedByUserIds: [] }),
        makeItem({
          amountCents: 200,
          claimedByUserIds: [],
          isTaxOrTip: true,
        }),
      ];
      expect(computeBillSplits(items)).toEqual([]);
    });
  });

  describe("mixed scenarios", () => {
    it("some items claimed, some not — only claimed ones count", () => {
      const items = [
        makeItem({ amountCents: 500, claimedByUserIds: ["user-a"] }),
        makeItem({ amountCents: 800, claimedByUserIds: [] }), // unclaimed
        makeItem({ amountCents: 300, claimedByUserIds: ["user-b"] }),
      ];
      const result = computeBillSplits(items);
      expect(result).toEqual([
        { userId: "user-a", amountCents: 500 },
        { userId: "user-b", amountCents: 300 },
      ]);
    });

    it("single person claims everything including tax", () => {
      const items = [
        makeItem({ amountCents: 2000, claimedByUserIds: ["user-a"] }),
        makeItem({ amountCents: 500, claimedByUserIds: ["user-a"] }),
        makeItem({
          amountCents: 300,
          claimedByUserIds: [],
          isTaxOrTip: true,
        }),
      ];
      const result = computeBillSplits(items);
      expect(result).toEqual([{ userId: "user-a", amountCents: 2800 }]);
    });

    it("full restaurant scenario with shared items and tip", () => {
      // user-a and user-b share appetizer ($2000), user-a gets entree ($1500),
      // user-b gets entree ($1200), tip ($500)
      // Regular items:
      //   appetizer: user-a = 1000, user-b = 1000
      //   user-a entree: user-a = 1500
      //   user-b entree: user-b = 1200
      // Subtotals: user-a = 2500, user-b = 2200, total = 4700
      // Tip ($500):
      //   user-a: floor(500 * 2500 / 4700) = floor(265.96) = 265
      //   user-b: floor(500 * 2200 / 4700) = floor(234.04) = 234
      //   distributed = 499, remainder = 1 → goes to user-a (highest subtotal)
      // Final: user-a = 2500 + 265 + 1 = 2766, user-b = 2200 + 234 = 2434
      const items = [
        makeItem({
          amountCents: 2000,
          claimedByUserIds: ["user-a", "user-b"],
          description: "Appetizer",
        }),
        makeItem({
          amountCents: 1500,
          claimedByUserIds: ["user-a"],
          description: "Entree A",
        }),
        makeItem({
          amountCents: 1200,
          claimedByUserIds: ["user-b"],
          description: "Entree B",
        }),
        makeItem({
          amountCents: 500,
          claimedByUserIds: [],
          isTaxOrTip: true,
          description: "Tip",
        }),
      ];
      const result = computeBillSplits(items);

      const total = result.reduce((s, r) => s + r.amountCents, 0);
      expect(total).toBe(5200); // 4700 + 500

      const aAmount = result.find((r) => r.userId === "user-a")?.amountCents;
      const bAmount = result.find((r) => r.userId === "user-b")?.amountCents;

      expect(aAmount).toBe(2766);
      expect(bAmount).toBe(2434);
    });
  });

  describe("output ordering", () => {
    it("results are sorted by userId for determinism", () => {
      const items = [
        makeItem({ amountCents: 500, claimedByUserIds: ["user-z"] }),
        makeItem({ amountCents: 300, claimedByUserIds: ["user-a"] }),
        makeItem({ amountCents: 400, claimedByUserIds: ["user-m"] }),
      ];
      const result = computeBillSplits(items);
      expect(result.map((r) => r.userId)).toEqual([
        "user-a",
        "user-m",
        "user-z",
      ]);
    });

    it("excludes users who owe 0 cents", () => {
      // If an item has 0 amountCents and is the only claim, that user ends up with 0
      const items = [
        makeItem({ amountCents: 0, claimedByUserIds: ["user-a"] }),
        makeItem({ amountCents: 500, claimedByUserIds: ["user-b"] }),
      ];
      const result = computeBillSplits(items);
      // user-a owes 0, so excluded
      expect(result).toEqual([{ userId: "user-b", amountCents: 500 }]);
    });
  });

  describe("multiple tax/tip items", () => {
    it("handles multiple separate tax and tip line items", () => {
      // user-a: $1000, user-b: $1000
      // tax: $100, tip: $200
      // Each person gets half of each tax/tip item
      const items = [
        makeItem({ amountCents: 1000, claimedByUserIds: ["user-a"] }),
        makeItem({ amountCents: 1000, claimedByUserIds: ["user-b"] }),
        makeItem({
          amountCents: 100,
          claimedByUserIds: [],
          isTaxOrTip: true,
          description: "Tax",
        }),
        makeItem({
          amountCents: 200,
          claimedByUserIds: [],
          isTaxOrTip: true,
          description: "Tip",
        }),
      ];
      const result = computeBillSplits(items);

      const total = result.reduce((s, r) => s + r.amountCents, 0);
      expect(total).toBe(2300); // 2000 + 100 + 200

      const aAmount = result.find((r) => r.userId === "user-a")?.amountCents;
      const bAmount = result.find((r) => r.userId === "user-b")?.amountCents;

      expect(aAmount).toBe(1150);
      expect(bAmount).toBe(1150);
    });
  });
});
