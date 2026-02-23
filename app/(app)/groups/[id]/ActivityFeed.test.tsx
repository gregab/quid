// @vitest-environment happy-dom

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ActivityFeed, type ActivityLog } from "./ActivityFeed";

afterEach(cleanup);

function makeLog(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: "log-1",
    action: "expense_added",
    payload: { description: "Dinner", amountCents: 2500, paidByDisplayName: "Alice" },
    createdAt: new Date("2024-01-15T12:00:00Z"),
    actor: { displayName: "Alice" },
    ...overrides,
  };
}

describe("ActivityFeed", () => {
  it("shows empty state when no logs", () => {
    render(<ActivityFeed logs={[]} />);
    expect(screen.getByText("No activity yet.")).toBeDefined();
  });

  it("renders log with actor name and action", () => {
    render(<ActivityFeed logs={[makeLog({ action: "expense_added" })]} />);
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("added")).toBeDefined();
    expect(screen.getByText("Dinner")).toBeDefined();
  });

  it("renders edit action label", () => {
    render(<ActivityFeed logs={[makeLog({ action: "expense_edited" })]} />);
    expect(screen.getByText("edited")).toBeDefined();
  });

  it("renders delete action label", () => {
    render(<ActivityFeed logs={[makeLog({ action: "expense_deleted" })]} />);
    expect(screen.getByText("deleted")).toBeDefined();
  });

  it("applies opacity class to pending logs", () => {
    const { container } = render(
      <ActivityFeed logs={[makeLog({ id: "pending-1", isPending: true })]} />
    );
    const row = container.querySelector(".opacity-60");
    expect(row, "pending log should have opacity-60 class").not.toBeNull();
  });

  it("does not apply opacity class to non-pending logs", () => {
    const { container } = render(
      <ActivityFeed logs={[makeLog({ id: "log-1", isPending: false })]} />
    );
    const row = container.querySelector(".opacity-60");
    expect(row, "non-pending log should not have opacity-60 class").toBeNull();
  });

  it("renders multiple logs", () => {
    const logs = [
      makeLog({ id: "log-1", action: "expense_added" }),
      makeLog({ id: "log-2", action: "expense_deleted" }),
    ];
    render(<ActivityFeed logs={logs} />);
    expect(screen.getAllByText("Alice")).toHaveLength(2);
  });
});

describe("ActivityFeed — member_left", () => {
  it("renders 'left the group' for member_left action", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "member_left",
            payload: { displayName: "Alice" },
            actor: { displayName: "Alice" },
          }),
        ]}
      />
    );
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("left the group")).toBeDefined();
  });

  it("applies opacity class to pending member_left log", () => {
    const { container } = render(
      <ActivityFeed
        logs={[
          makeLog({
            id: "pending-left",
            action: "member_left",
            payload: { displayName: "Bob" },
            actor: { displayName: "Bob" },
            isPending: true,
          }),
        ]}
      />
    );
    const row = container.querySelector(".opacity-60");
    expect(row, "pending member_left log should have opacity-60 class").not.toBeNull();
  });

  it("does not add cursor-pointer to member_left rows", () => {
    const { container } = render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "member_left",
            payload: { displayName: "Alice" },
            actor: { displayName: "Alice" },
          }),
        ]}
      />
    );
    const row = container.querySelector(".cursor-pointer");
    expect(row, "member_left row should not be clickable").toBeNull();
  });

  it("clicking a member_left row does not open a modal", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "member_left",
            payload: { displayName: "Alice" },
            actor: { displayName: "Alice" },
          }),
        ]}
      />
    );
    fireEvent.click(screen.getByText("left the group").closest("div")!);
    // No modal open = no Close button anywhere in the tree
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});

describe("ActivityFeed — expense_edited amount display", () => {
  it("shows old → new amount when the amount changed", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: { description: "Dinner", amountCents: 3000, previousAmountCents: 2500, paidByDisplayName: "Alice" },
          }),
        ]}
      />
    );
    expect(screen.getByText(/\$25\.00 → \$30\.00/)).toBeDefined();
  });

  it("shows only the new amount when the amount did not change (description-only edit)", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: { description: "Dinner", amountCents: 2500, previousAmountCents: 2500, paidByDisplayName: "Alice" },
          }),
        ]}
      />
    );
    expect(screen.queryByText(/→/)).toBeNull();
    expect(screen.getByText(/\$25\.00/)).toBeDefined();
  });

  it("shows only the amount when previousAmountCents is absent (older log entries)", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: { description: "Dinner", amountCents: 2500, paidByDisplayName: "Alice" },
          }),
        ]}
      />
    );
    expect(screen.queryByText(/→/)).toBeNull();
    expect(screen.getByText(/\$25\.00/)).toBeDefined();
  });

  it("does not show an arrow for expense_added even with a prior amount in payload", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_added",
            payload: { description: "Dinner", amountCents: 3000, previousAmountCents: 2500, paidByDisplayName: "Alice" },
          }),
        ]}
      />
    );
    // Arrow only shows for expense_edited
    expect(screen.queryByText(/→/)).toBeNull();
  });
});

describe("ActivityFeed — expense_edited rich descriptions", () => {
  it("shows 'changed the price on' for amount change", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 3000,
              paidByDisplayName: "Alice",
              changes: { amount: { from: 2500, to: 3000 } },
            },
          }),
        ]}
      />
    );
    expect(screen.getByText(/changed the price on/)).toBeDefined();
    expect(screen.getByText(/\$25\.00 → \$30\.00/)).toBeDefined();
  });

  it("shows 'changed the date on' for date change", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 2500,
              paidByDisplayName: "Alice",
              changes: { date: { from: "2024-01-05", to: "2024-01-06" } },
            },
          }),
        ]}
      />
    );
    expect(screen.getByText(/changed the date on/)).toBeDefined();
    expect(screen.getByText(/Jan 5 → Jan 6/)).toBeDefined();
  });

  it("shows 'added [name] to' for a single participant addition", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 2500,
              paidByDisplayName: "Alice",
              changes: { participants: { added: ["Bob"], removed: [] } },
            },
          }),
        ]}
      />
    );
    expect(screen.getByText(/added Bob to/)).toBeDefined();
  });

  it("shows 'added [names] to' for multiple participant additions", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 2500,
              paidByDisplayName: "Alice",
              changes: { participants: { added: ["Greg", "Alex"], removed: [] } },
            },
          }),
        ]}
      />
    );
    expect(screen.getByText(/added Greg and Alex to/)).toBeDefined();
  });

  it("shows 'removed [name] from' for a participant removal", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 2500,
              paidByDisplayName: "Alice",
              changes: { participants: { added: [], removed: ["Bob"] } },
            },
          }),
        ]}
      />
    );
    expect(screen.getByText(/removed Bob from/)).toBeDefined();
  });

  it("shows 'added X, removed Y on' when both adding and removing participants", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 2500,
              paidByDisplayName: "Alice",
              changes: { participants: { added: ["Greg"], removed: ["Bob"] } },
            },
          }),
        ]}
      />
    );
    expect(screen.getByText(/added Greg, removed Bob on/)).toBeDefined();
  });

  it("shows 'renamed' with old→new names for a description-only change", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Uber",
              amountCents: 2500,
              paidByDisplayName: "Alice",
              changes: { description: { from: "Taxi", to: "Uber" } },
            },
          }),
        ]}
      />
    );
    expect(screen.getByText(/renamed/)).toBeDefined();
    expect(screen.getByText(/Taxi → Uber/)).toBeDefined();
  });

  it("shows 'changed the payer on' for a paidBy change", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 2500,
              paidByDisplayName: "Alice",
              changes: { paidBy: { from: "Bob", to: "Alice" } },
            },
          }),
        ]}
      />
    );
    expect(screen.getByText(/changed the payer on/)).toBeDefined();
    expect(screen.getByText(/Bob → Alice/)).toBeDefined();
  });

  it("combines multiple change types joined by 'and'", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 3000,
              paidByDisplayName: "Alice",
              changes: {
                amount: { from: 2500, to: 3000 },
                date: { from: "2024-01-05", to: "2024-01-06" },
              },
            },
          }),
        ]}
      />
    );
    expect(screen.getByText(/changed the price and changed the date on/)).toBeDefined();
    expect(screen.getByText(/\$25\.00 → \$30\.00/)).toBeDefined();
    expect(screen.getByText(/Jan 5 → Jan 6/)).toBeDefined();
  });

  it("falls back to 'edited' when changes object is empty", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 2500,
              paidByDisplayName: "Alice",
              changes: {},
            },
          }),
        ]}
      />
    );
    expect(screen.getByText("edited")).toBeDefined();
  });
});

describe("ActivityFeed — deleted account fallback", () => {
  it("renders 'Deleted User' as actor name when the account no longer exists", () => {
    // page.tsx sets actor: log.User ?? { displayName: "Deleted User" } for null joins
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_added",
            actor: { displayName: "Deleted User" },
            payload: { description: "Dinner", amountCents: 2500 },
          }),
        ]}
      />
    );
    expect(screen.getByText("Deleted U.")).toBeDefined();
    // The rest of the log still renders
    expect(screen.getByText("added")).toBeDefined();
    expect(screen.getByText("Dinner")).toBeDefined();
  });

  it("renders 'Deleted User' for a member_left log from a deleted account", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "member_left",
            actor: { displayName: "Deleted User" },
            payload: { displayName: "Deleted User" },
          }),
        ]}
      />
    );
    expect(screen.getByText("Deleted U.")).toBeDefined();
    expect(screen.getByText("left the group")).toBeDefined();
  });
});

describe("ActivityFeed — relative timestamp formatting", () => {
  it("shows correct relative time for a Supabase timestamp string without Z suffix", () => {
    // Supabase returns TIMESTAMP WITHOUT TIME ZONE as strings with no timezone
    // suffix (e.g. "2024-01-15T10:30:00"). Without a Z, JS parses as local time,
    // making UTC timestamps appear future for users west of UTC → "just now" bug.
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    // Simulate Supabase: ISO string with no Z (strip the trailing Z)
    const supabaseStyle = twoHoursAgo.toISOString().replace("Z", "");
    render(<ActivityFeed logs={[makeLog({ createdAt: supabaseStyle })]} />);
    expect(screen.getByText("2h ago")).toBeDefined();
  });
});

describe("ActivityFeed — payment_recorded and payment_deleted", () => {
  it("renders 'recorded a payment' with from/to names and amount", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "payment_recorded",
            payload: { amountCents: 5000, fromDisplayName: "Alice", toDisplayName: "Bob" },
            actor: { displayName: "Alice" },
          }),
        ]}
      />
    );
    // "Alice" appears twice: once as actor name, once as fromDisplayName
    expect(screen.getAllByText("Alice")).toHaveLength(2);
    expect(screen.getByText(/recorded a payment/)).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
    expect(screen.getByText(/\$50\.00/)).toBeDefined();
  });

  it("renders 'deleted a payment' with from/to names and amount", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "payment_deleted",
            payload: { amountCents: 5000, fromDisplayName: "Alice", toDisplayName: "Bob" },
            actor: { displayName: "Greg" },
          }),
        ]}
      />
    );
    expect(screen.getByText("Greg")).toBeDefined();
    expect(screen.getByText(/deleted a payment/)).toBeDefined();
    expect(screen.getByText(/\$50\.00/)).toBeDefined();
  });

  it("applies opacity class to pending payment_recorded log", () => {
    const { container } = render(
      <ActivityFeed
        logs={[
          makeLog({
            id: "pending-pay",
            action: "payment_recorded",
            payload: { amountCents: 3000, fromDisplayName: "Alice", toDisplayName: "Bob" },
            actor: { displayName: "Alice" },
            isPending: true,
          }),
        ]}
      />
    );
    const row = container.querySelector(".opacity-60");
    expect(row, "pending payment_recorded log should have opacity-60 class").not.toBeNull();
  });
});

describe("ActivityFeed — click to open modal", () => {
  it("clicking an expense_added row opens the detail modal", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_added",
            payload: { description: "Dinner", amountCents: 2500, paidByDisplayName: "Alice" },
            actor: { displayName: "Alice" },
          }),
        ]}
      />
    );
    fireEvent.click(screen.getByText("Dinner").closest("div")!);
    // Modal header
    expect(screen.getByText("Expense added")).toBeDefined();
    // Modal content — description label + name
    expect(screen.getAllByText("Dinner").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("$25.00")).toBeDefined();
  });

  it("clicking an expense_deleted row opens the detail modal", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_deleted",
            payload: { description: "Lunch", amountCents: 1200, paidByDisplayName: "Bob" },
            actor: { displayName: "Bob" },
          }),
        ]}
      />
    );
    fireEvent.click(screen.getByText("Lunch").closest("div")!);
    expect(screen.getByText("Expense deleted")).toBeDefined();
    expect(screen.getByText("$12.00")).toBeDefined();
  });

  it("clicking an expense_edited row opens the modal with changes", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 3000,
              paidByDisplayName: "Alice",
              changes: { amount: { from: 2500, to: 3000 } },
            },
            actor: { displayName: "Alice" },
          }),
        ]}
      />
    );
    fireEvent.click(screen.getByText("Dinner").closest("div")!);
    expect(screen.getByText("Expense edited")).toBeDefined();
    expect(screen.getByText("Changes")).toBeDefined();
    expect(screen.getByText(/Amount:/)).toBeDefined();
  });

  it("clicking a payment_recorded row opens the detail modal", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "payment_recorded",
            payload: { amountCents: 5000, fromDisplayName: "Alice", toDisplayName: "Bob" },
            actor: { displayName: "Alice" },
          }),
        ]}
      />
    );
    // Click anywhere on the row
    fireEvent.click(screen.getByText(/recorded a payment/).closest("div")!);
    expect(screen.getByText("Payment recorded")).toBeDefined();
    expect(screen.getByText("$50.00")).toBeDefined();
    expect(screen.getByText("From")).toBeDefined();
    expect(screen.getByText("To")).toBeDefined();
  });

  it("clicking a pending row does not open the modal", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_added",
            payload: { description: "Dinner", amountCents: 2500, paidByDisplayName: "Alice" },
            isPending: true,
          }),
        ]}
      />
    );
    fireEvent.click(screen.getByText("Dinner").closest("div")!);
    expect(screen.queryByText("Expense added")).toBeNull();
  });

  it("closing the modal via the Close button removes it", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_added",
            payload: { description: "Dinner", amountCents: 2500, paidByDisplayName: "Alice" },
          }),
        ]}
      />
    );
    fireEvent.click(screen.getByText("Dinner").closest("div")!);
    expect(screen.getByText("Expense added")).toBeDefined();
    // Click the footer Close button (last among buttons named "Close")
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    fireEvent.click(closeButtons[closeButtons.length - 1]!);
    expect(screen.queryByText("Expense added")).toBeNull();
  });

  it("expense_edited modal shows fallback amount when no rich changes", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 3000,
              previousAmountCents: 2500,
              paidByDisplayName: "Alice",
            },
            actor: { displayName: "Alice" },
          }),
        ]}
      />
    );
    // Open modal
    fireEvent.click(screen.getByText("Dinner").closest("div")!);
    expect(screen.getByText("Expense edited")).toBeDefined();
    // Should show the old → new amount
    const modalAmounts = screen.getAllByText(/\$25\.00 → \$30\.00/);
    expect(modalAmounts.length).toBeGreaterThanOrEqual(1);
  });
});
