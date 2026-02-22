// @vitest-environment happy-dom

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
