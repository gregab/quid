// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
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

describe("ActivityFeed — expense_edited modal fallback for old log entries", () => {
  it("modal shows old → new amount for old-format logs (no changes object)", () => {
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
    // List item just shows "edited"
    expect(screen.getByText("edited")).toBeDefined();
    // Open modal to see amount detail
    fireEvent.click(screen.getByText("Dinner").closest("div")!);
    expect(screen.getByText(/\$25\.00 → \$30\.00/)).toBeDefined();
  });

  it("modal shows only the new amount when amount did not change", () => {
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
    fireEvent.click(screen.getByText("Dinner").closest("div")!);
    expect(screen.queryByText(/\$25\.00 → /)).toBeNull();
    expect(screen.getByText(/\$25\.00/)).toBeDefined();
  });

  it("modal shows only the amount when previousAmountCents is absent (older log entries)", () => {
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
    fireEvent.click(screen.getByText("Dinner").closest("div")!);
    expect(screen.queryByText(/\$25\.00 → /)).toBeNull();
    expect(screen.getByText(/\$25\.00/)).toBeDefined();
  });

  it("does not show an arrow in the list for expense_added even with a prior amount in payload", () => {
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
    // No → in the list item
    expect(screen.queryByText(/→/)).toBeNull();
  });
});

describe("ActivityFeed — expense_edited list item", () => {
  it("always shows 'edited' for amount-only change", () => {
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
    expect(screen.getByText("edited")).toBeDefined();
    expect(screen.getByText("Dinner")).toBeDefined();
    // Verbose descriptions are modal-only — not in the list item
    expect(screen.queryByText(/changed the price/)).toBeNull();
  });

  it("always shows 'edited' for participant change", () => {
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
    expect(screen.getByText("edited")).toBeDefined();
    expect(screen.queryByText(/added Bob/)).toBeNull();
  });

  it("always shows 'edited' for a description rename", () => {
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
    expect(screen.getByText("edited")).toBeDefined();
    // Rename detail is modal-only
    expect(screen.queryByText(/renamed/)).toBeNull();
  });

  it("shows 'edited' when changes object is empty", () => {
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

describe("ActivityFeed — load more", () => {
  it("does not show Load more button when hasMore is false", () => {
    render(<ActivityFeed logs={[makeLog()]} hasMore={false} />);
    expect(screen.queryByText("Load more")).toBeNull();
  });

  it("shows Load more button when hasMore is true", () => {
    render(<ActivityFeed logs={[makeLog()]} hasMore={true} onLoadMore={vi.fn()} />);
    expect(screen.getByText("Load more")).toBeDefined();
  });

  it("calls onLoadMore when button is clicked", () => {
    const onLoadMore = vi.fn();
    render(<ActivityFeed logs={[makeLog()]} hasMore={true} onLoadMore={onLoadMore} />);
    fireEvent.click(screen.getByText("Load more"));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("shows Loading… and disables button when isLoadingMore is true", () => {
    render(<ActivityFeed logs={[makeLog()]} hasMore={true} isLoadingMore={true} />);
    const btn = screen.getByText("Loading…");
    expect(btn).toBeDefined();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
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

describe("ActivityFeed — splits display in modals", () => {
  it("expense_added modal shows per-person split amounts when splits present", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_added",
            payload: {
              description: "Birdseed",
              amountCents: 3000,
              paidByDisplayName: "Greg",
              splitType: "equal",
              splits: [
                { displayName: "Greg", amountCents: 1000 },
                { displayName: "Alice", amountCents: 1000 },
                { displayName: "Bob", amountCents: 1000 },
              ],
            },
            actor: { displayName: "Greg" },
          }),
        ]}
      />
    );
    fireEvent.click(screen.getByText("Birdseed").closest("div")!);
    expect(screen.getByText("Expense added")).toBeDefined();
    expect(screen.getByText(/Split/)).toBeDefined();
    expect(screen.getByText(/Greg · \$10\.00/)).toBeDefined();
    expect(screen.getByText(/Alice · \$10\.00/)).toBeDefined();
    expect(screen.getByText(/Bob · \$10\.00/)).toBeDefined();
  });

  it("expense_added modal falls back to name list for old logs without splits", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_added",
            payload: {
              description: "Birdseed",
              amountCents: 3000,
              paidByDisplayName: "Greg",
              participantDisplayNames: ["Greg", "Alice", "Bob"],
            },
            actor: { displayName: "Greg" },
          }),
        ]}
      />
    );
    fireEvent.click(screen.getByText("Birdseed").closest("div")!);
    expect(screen.getByText("Split between")).toBeDefined();
    expect(screen.getByText(/Greg, Alice, and Bob/)).toBeDefined();
  });

  it("expense_deleted modal shows split snapshot with amounts", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_deleted",
            payload: {
              description: "Lunch",
              amountCents: 2000,
              paidByDisplayName: "Alice",
              splitType: "custom",
              splits: [
                { displayName: "Alice", amountCents: 1500 },
                { displayName: "Bob", amountCents: 500 },
              ],
            },
            actor: { displayName: "Alice" },
          }),
        ]}
      />
    );
    fireEvent.click(screen.getByText("Lunch").closest("div")!);
    expect(screen.getByText("Expense deleted")).toBeDefined();
    expect(screen.getByText(/Custom/)).toBeDefined();
    expect(screen.getByText(/Alice · \$15\.00/)).toBeDefined();
    expect(screen.getByText(/Bob · \$5\.00/)).toBeDefined();
  });

  it("expense_edited modal shows before/after splits when both present", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 3000,
              paidByDisplayName: "Greg",
              splitType: "equal",
              splitsBefore: [
                { displayName: "Greg", amountCents: 1500 },
                { displayName: "Alice", amountCents: 1500 },
              ],
              splits: [
                { displayName: "Greg", amountCents: 1000 },
                { displayName: "Alice", amountCents: 1000 },
                { displayName: "Bob", amountCents: 1000 },
              ],
              changes: { participants: { added: ["Bob"], removed: [] } },
            },
            actor: { displayName: "Greg" },
          }),
        ]}
      />
    );
    fireEvent.click(screen.getByText("Dinner").closest("div")!);
    expect(screen.getByText("Expense edited")).toBeDefined();
    expect(screen.getByText("Before")).toBeDefined();
    expect(screen.getByText("After")).toBeDefined();
    // Before amounts
    expect(screen.getByText(/Greg · \$15\.00/)).toBeDefined();
    // After amounts
    expect(screen.getByText(/Bob · \$10\.00/)).toBeDefined();
  });

  it("expense_edited modal shows splitType change in Changes section", () => {
    render(
      <ActivityFeed
        logs={[
          makeLog({
            action: "expense_edited",
            payload: {
              description: "Dinner",
              amountCents: 3000,
              paidByDisplayName: "Greg",
              splitType: "custom",
              changes: { splitType: { from: "equal", to: "custom" } },
            },
            actor: { displayName: "Greg" },
          }),
        ]}
      />
    );
    fireEvent.click(screen.getByText("Dinner").closest("div")!);
    expect(screen.getByText(/Split type:/)).toBeDefined();
    expect(screen.getByText(/Equal.*Custom/)).toBeDefined();
  });
});
