import { describe, it, expect } from "vitest";
import { computeExpenseChanges, buildSplitSnapshot } from "./activityDiff";

// ---------------------------------------------------------------------------
// computeExpenseChanges
// ---------------------------------------------------------------------------

describe("computeExpenseChanges", () => {
  const oldExpense = {
    amountCents: 6000,
    description: "Dinner",
    date: "2026-03-01",
    paidById: "alice",
    paidByDisplayName: "Alice Smith",
    splitType: "equal",
  };

  const newExpense = {
    amountCents: 6000,
    description: "Dinner",
    date: "2026-03-01",
    paidById: "alice",
    paidByDisplayName: "Alice Smith",
    splitType: "equal",
  };

  const participants = ["alice", "bob", "carol"];

  const resolveName = (id: string) => {
    const names: Record<string, string> = {
      alice: "Alice Smith",
      bob: "Bob Jones",
      carol: "Carol Lee",
      dave: "Dave Kim",
    };
    return names[id] ?? "Unknown";
  };

  it("returns empty object when nothing changed", () => {
    const changes = computeExpenseChanges(
      oldExpense,
      newExpense,
      participants,
      participants,
      resolveName
    );
    expect(changes).toEqual({});
  });

  it("detects amount change", () => {
    const changes = computeExpenseChanges(
      oldExpense,
      { ...newExpense, amountCents: 9000 },
      participants,
      participants,
      resolveName
    );
    expect(changes.amount).toEqual({ from: 6000, to: 9000 });
    expect(changes.description).toBeUndefined();
  });

  it("detects description change", () => {
    const changes = computeExpenseChanges(
      oldExpense,
      { ...newExpense, description: "Late-night dinner" },
      participants,
      participants,
      resolveName
    );
    expect(changes.description).toEqual({
      from: "Dinner",
      to: "Late-night dinner",
    });
  });

  it("detects date change", () => {
    const changes = computeExpenseChanges(
      oldExpense,
      { ...newExpense, date: "2026-03-02" },
      participants,
      participants,
      resolveName
    );
    expect(changes.date).toEqual({ from: "2026-03-01", to: "2026-03-02" });
  });

  it("detects paidBy change with display names", () => {
    const changes = computeExpenseChanges(
      oldExpense,
      { ...newExpense, paidById: "bob", paidByDisplayName: "Bob Jones" },
      participants,
      participants,
      resolveName
    );
    expect(changes.paidBy).toEqual({
      from: "Alice Smith",
      to: "Bob Jones",
    });
  });

  it("detects participant added", () => {
    const changes = computeExpenseChanges(
      oldExpense,
      newExpense,
      ["alice", "bob"],
      ["alice", "bob", "carol"],
      resolveName
    );
    expect(changes.participants).toEqual({
      added: ["Carol Lee"],
      removed: [],
    });
  });

  it("detects participant removed", () => {
    const changes = computeExpenseChanges(
      oldExpense,
      newExpense,
      ["alice", "bob", "carol"],
      ["alice", "bob"],
      resolveName
    );
    expect(changes.participants).toEqual({
      added: [],
      removed: ["Carol Lee"],
    });
  });

  it("detects participants added and removed simultaneously", () => {
    const changes = computeExpenseChanges(
      oldExpense,
      newExpense,
      ["alice", "bob"],
      ["alice", "dave"],
      resolveName
    );
    expect(changes.participants).toEqual({
      added: ["Dave Kim"],
      removed: ["Bob Jones"],
    });
  });

  it("does not report participant change when sets are identical (different order)", () => {
    const changes = computeExpenseChanges(
      oldExpense,
      newExpense,
      ["bob", "alice", "carol"],
      ["carol", "alice", "bob"],
      resolveName
    );
    expect(changes.participants).toBeUndefined();
  });

  it("detects splitType change", () => {
    const changes = computeExpenseChanges(
      oldExpense,
      { ...newExpense, splitType: "custom" },
      participants,
      participants,
      resolveName
    );
    expect(changes.splitType).toEqual({ from: "equal", to: "custom" });
  });

  it("defaults old splitType to 'equal' when undefined", () => {
    const { splitType: _, ...oldWithoutSplitType } = oldExpense;
    const changes = computeExpenseChanges(
      oldWithoutSplitType,
      { ...newExpense, splitType: "custom" },
      participants,
      participants,
      resolveName
    );
    expect(changes.splitType).toEqual({ from: "equal", to: "custom" });
  });

  it("detects multiple changes at once", () => {
    const changes = computeExpenseChanges(
      oldExpense,
      {
        ...newExpense,
        amountCents: 9000,
        description: "Updated dinner",
        date: "2026-03-05",
        paidById: "bob",
        paidByDisplayName: "Bob Jones",
        splitType: "custom",
      },
      ["alice", "bob"],
      ["alice", "bob", "carol"],
      resolveName
    );
    expect(changes.amount).toBeDefined();
    expect(changes.description).toBeDefined();
    expect(changes.date).toBeDefined();
    expect(changes.paidBy).toBeDefined();
    expect(changes.participants).toBeDefined();
    expect(changes.splitType).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// buildSplitSnapshot
// ---------------------------------------------------------------------------

describe("buildSplitSnapshot", () => {
  it("returns a clean copy of split data", () => {
    const splits = [
      { displayName: "Alice", amountCents: 2000, extraField: "ignored" },
      { displayName: "Bob", amountCents: 1000, extraField: "ignored" },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = buildSplitSnapshot(splits as any);
    expect(result).toEqual([
      { displayName: "Alice", amountCents: 2000 },
      { displayName: "Bob", amountCents: 1000 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(buildSplitSnapshot([])).toEqual([]);
  });

  it("preserves order", () => {
    const splits = [
      { displayName: "Zara", amountCents: 3000 },
      { displayName: "Amy", amountCents: 1000 },
    ];
    const result = buildSplitSnapshot(splits);
    expect(result[0]!.displayName).toBe("Zara");
    expect(result[1]!.displayName).toBe("Amy");
  });
});
