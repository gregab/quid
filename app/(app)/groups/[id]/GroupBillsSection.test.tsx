// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { GroupBillsSection } from "./GroupBillsSection";
import type { GroupBillSummary } from "@aviary/shared";

afterEach(cleanup);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Mock the CreateGroupBillDialog so it can be rendered without network calls
vi.mock("./CreateGroupBillDialog", () => ({
  CreateGroupBillDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="create-bill-dialog">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

const BASE_PROPS = {
  groupId: "group-1",
  currentUserId: "user-1",
  members: [
    { userId: "user-1", displayName: "Alice" },
    { userId: "user-2", displayName: "Bob" },
  ],
};

function makeBill(overrides: Partial<GroupBillSummary> = {}): GroupBillSummary {
  return {
    id: "bill-1",
    groupId: "group-1",
    name: "Dinner at Nobu",
    status: "in_progress",
    expenseId: null,
    createdAt: "2024-01-15T00:00:00Z",
    receiptImageUrl: "group-1/bill-1.jpg",
    itemCount: 4,
    unclaimedCount: 1,
    ...overrides,
  };
}

describe("GroupBillsSection", () => {
  it("renders the Scan Receipt button", () => {
    render(<GroupBillsSection {...BASE_PROPS} initialBills={[]} />);
    expect(screen.getByRole("button", { name: /scan receipt/i })).toBeDefined();
  });

  it("does not show group bills header when there are no in-progress bills", () => {
    render(<GroupBillsSection {...BASE_PROPS} initialBills={[]} />);
    expect(screen.queryByText("Group Bills")).toBeNull();
  });

  it("shows in-progress bills", () => {
    const bill = makeBill({ name: "Dinner at Nobu" });
    render(<GroupBillsSection {...BASE_PROPS} initialBills={[bill]} />);

    expect(screen.getByText("Group Bills")).toBeDefined();
    expect(screen.getByText("Dinner at Nobu")).toBeDefined();
  });

  it("shows item count and unclaimed warning on bills", () => {
    const bill = makeBill({ itemCount: 4, unclaimedCount: 2 });
    render(<GroupBillsSection {...BASE_PROPS} initialBills={[bill]} />);

    expect(screen.getByText(/4 items/)).toBeDefined();
    expect(screen.getByText(/2 unclaimed/)).toBeDefined();
  });

  it("does not show unclaimed warning when all items are claimed", () => {
    const bill = makeBill({ itemCount: 3, unclaimedCount: 0 });
    render(<GroupBillsSection {...BASE_PROPS} initialBills={[bill]} />);

    expect(screen.queryByText(/unclaimed/)).toBeNull();
  });

  it("does not show finalized bills in the list", () => {
    const finalizedBill = makeBill({ name: "Old Dinner", status: "finalized" });
    render(<GroupBillsSection {...BASE_PROPS} initialBills={[finalizedBill]} />);

    expect(screen.queryByText("Old Dinner")).toBeNull();
    expect(screen.queryByText("Group Bills")).toBeNull();
  });

  it("opens dialog when Scan Receipt button is clicked", () => {
    render(<GroupBillsSection {...BASE_PROPS} initialBills={[]} />);

    expect(screen.queryByTestId("create-bill-dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /scan receipt/i }));

    expect(screen.getByTestId("create-bill-dialog")).toBeDefined();
  });

  it("closes dialog when Close is clicked", () => {
    render(<GroupBillsSection {...BASE_PROPS} initialBills={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /scan receipt/i }));
    expect(screen.getByTestId("create-bill-dialog")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByTestId("create-bill-dialog")).toBeNull();
  });

  it("shows single item with singular 'item' label", () => {
    const bill = makeBill({ itemCount: 1, unclaimedCount: 0 });
    render(<GroupBillsSection {...BASE_PROPS} initialBills={[bill]} />);

    expect(screen.getByText(/1 item$/)).toBeDefined();
  });
});
