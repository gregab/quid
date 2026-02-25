import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { createTestQueryClient } from "../../../../lib/test-utils";
import AddMemberScreen from "./add-member";

const mockMutateAsync = vi.fn();

vi.mock("../../../../lib/queries", () => ({
  useAddMember: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLocalSearchParams).mockReturnValue({ id: "group-1" });
});

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AddMemberScreen />
    </QueryClientProvider>,
  );
}

/** Get the "Add member" button (not the heading) — it's inside a <button> element */
function getAddMemberButton() {
  const all = screen.getAllByText("Add member");
  // The button is the one inside a <button> element
  return all.find((el) => el.closest("button")) ?? all[all.length - 1]!;
}

describe("AddMemberScreen", () => {
  it("renders title and email input", () => {
    renderWithProviders();
    // "Add member" appears as both heading and button text
    expect(screen.getAllByText("Add member").length).toBe(2);
    expect(screen.getByPlaceholderText("friend@example.com")).toBeTruthy();
  });

  it("shows validation error for invalid email", async () => {
    renderWithProviders();

    fireEvent.change(screen.getByPlaceholderText("friend@example.com"), {
      target: { value: "notanemail" },
    });

    await act(async () => {
      fireEvent.click(getAddMemberButton());
    });

    expect(screen.getByText("Please enter a valid email address.")).toBeTruthy();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("disables submit button when email is empty", () => {
    renderWithProviders();

    const button = getAddMemberButton();
    expect(button.closest("button")?.disabled ?? button.hasAttribute("disabled")).toBe(true);
  });

  it("calls addMember mutation with lowercased email", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      userId: "user-3",
      displayName: "Charlie",
      groupId: "group-1",
      joinedAt: "2026-02-20",
    });

    renderWithProviders();

    fireEvent.change(screen.getByPlaceholderText("friend@example.com"), {
      target: { value: "Charlie@Example.com" },
    });

    await act(async () => {
      fireEvent.click(getAddMemberButton());
    });

    expect(mockMutateAsync).toHaveBeenCalledWith("charlie@example.com");
  });

  it("shows success message after adding member", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      userId: "user-3",
      displayName: "Charlie",
      groupId: "group-1",
      joinedAt: "2026-02-20",
    });

    renderWithProviders();

    fireEvent.change(screen.getByPlaceholderText("friend@example.com"), {
      target: { value: "charlie@example.com" },
    });

    await act(async () => {
      fireEvent.click(getAddMemberButton());
    });

    expect(
      screen.getByText("Charlie has been added to the group!"),
    ).toBeTruthy();
  });

  it("shows error message when mutation fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new Error("No user found with that email address"),
    );

    renderWithProviders();

    fireEvent.change(screen.getByPlaceholderText("friend@example.com"), {
      target: { value: "nobody@example.com" },
    });

    await act(async () => {
      fireEvent.click(getAddMemberButton());
    });

    expect(
      screen.getByText("No user found with that email address"),
    ).toBeTruthy();
  });

  it("shows Done button", () => {
    renderWithProviders();
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("shows informational text about Aviary accounts", () => {
    renderWithProviders();
    expect(
      screen.getByText(/They must already have an Aviary account/),
    ).toBeTruthy();
  });
});
