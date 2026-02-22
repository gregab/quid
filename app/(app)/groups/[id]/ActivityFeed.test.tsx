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
