import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  createTestQueryClient,
  makeExpense,
  makeGroupDetail,
} from "../../../../lib/test-utils";

import GroupSettingsScreen from "./settings";

// Mock auth
vi.mock("../../../../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-1", email: "alice@example.com" },
    session: { access_token: "tok" },
    loading: false,
    signOut: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockLeaveAsync = vi.fn();
const mockUpdateGroupAsync = vi.fn();
const mockUseGroupDetail = vi.fn();
const mockUseGroupExpenses = vi.fn();

const mockUploadBannerAsync = vi.fn();
const mockDeleteGroupAsync = vi.fn();

vi.mock("../../../../lib/queries", () => ({
  useGroupDetail: () => mockUseGroupDetail(),
  useGroupExpenses: () => mockUseGroupExpenses(),
  useLeaveGroup: () => ({
    mutateAsync: mockLeaveAsync,
  }),
  useUpdateGroup: () => ({
    mutateAsync: mockUpdateGroupAsync,
    isPending: false,
  }),
  useUploadGroupBanner: () => ({
    mutateAsync: mockUploadBannerAsync,
    isPending: false,
  }),
  useDeleteGroup: () => ({
    mutateAsync: mockDeleteGroupAsync,
  }),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateGroupAsync.mockReset();
  vi.mocked(useLocalSearchParams).mockReturnValue({ id: "group-1" });
  mockUseGroupDetail.mockReturnValue({
    data: makeGroupDetail(),
    isLoading: false,
  });
  mockUseGroupExpenses.mockReturnValue({
    data: [],
    isLoading: false,
  });
});

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <GroupSettingsScreen />
    </QueryClientProvider>,
  );
}

describe("GroupSettingsScreen", () => {
  it("renders group name", () => {
    renderWithProviders();
    expect(screen.getByText("Test Group")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("shows member count", () => {
    renderWithProviders();
    expect(screen.getByText("Members")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("shows loading state", () => {
    mockUseGroupDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderWithProviders();
    expect(screen.queryByText("Settings")).toBeNull();
  });

  it("renders share invite link action", () => {
    renderWithProviders();
    expect(screen.getByText("Share invite link")).toBeTruthy();
  });

  it("renders add member by email action", () => {
    renderWithProviders();
    expect(screen.getByText("Add member by email")).toBeTruthy();
  });

  it("shows leave group button", () => {
    renderWithProviders();
    expect(screen.getByText("Leave group")).toBeTruthy();
  });

  it("shows outstanding balance warning when user owes money", () => {
    // Expense where user-1 owes user-2
    mockUseGroupExpenses.mockReturnValue({
      data: [
        makeExpense({
          paidById: "user-2",
          amountCents: 5000,
          participantIds: ["user-1", "user-2"],
          splits: [
            { userId: "user-1", amountCents: 2500 },
            { userId: "user-2", amountCents: 2500 },
          ],
        }),
      ],
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByText(/settle up first/)).toBeTruthy();
  });

  it("calls leaveGroup on confirmation when no balance", async () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);
    mockLeaveAsync.mockResolvedValueOnce({ deleted_group: false });

    renderWithProviders();

    await act(async () => {
      fireEvent.click(screen.getByText("Leave group"));
    });

    // Alert mock auto-clicks last button (destructive "Leave")
    expect(mockLeaveAsync).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/(app)/(dashboard)");
  });

  it("shows Back navigation", () => {
    renderWithProviders();
    expect(screen.getByText("Back")).toBeTruthy();
  });

  it("shows edit input when group name is tapped", async () => {
    renderWithProviders();
    await act(async () => {
      fireEvent.click(screen.getByText("Test Group"));
    });
    expect(screen.getByDisplayValue("Test Group")).toBeTruthy();
  });

  it("calls updateGroup when save is clicked after editing name", async () => {
    mockUpdateGroupAsync.mockResolvedValueOnce(undefined);
    renderWithProviders();
    await act(async () => {
      fireEvent.click(screen.getByText("Test Group"));
    });
    const input = screen.getByDisplayValue("Test Group");
    fireEvent.change(input, { target: { value: "New Name" } });
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(mockUpdateGroupAsync).toHaveBeenCalledWith({ name: "New Name" });
  });

  // --- Banner upload tests ---

  it("renders banner upload button when no banner set", () => {
    renderWithProviders();
    expect(screen.getByText("Add banner image")).toBeTruthy();
    expect(screen.getByTestId("banner-upload-button")).toBeTruthy();
  });

  it("shows banner preview when group has banner", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail({ bannerUrl: "https://example.com/banner.jpg" }),
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByTestId("banner-preview")).toBeTruthy();
    expect(screen.getByText("Change banner")).toBeTruthy();
  });

  it("renders Banner section header", () => {
    renderWithProviders();
    expect(screen.getByText("Banner")).toBeTruthy();
  });

  // --- Delete group tests ---

  it("shows delete group button when user is the creator", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail({ createdById: "user-1" }),
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.getByText("Delete group")).toBeTruthy();
    expect(screen.getByTestId("delete-group-button")).toBeTruthy();
  });

  it("hides delete group button when user is not the creator", () => {
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail({ createdById: "user-other" }),
      isLoading: false,
    });
    renderWithProviders();
    expect(screen.queryByText("Delete group")).toBeNull();
    expect(screen.queryByTestId("delete-group-button")).toBeNull();
  });

  it("calls deleteGroup on confirmation", async () => {
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);
    mockDeleteGroupAsync.mockResolvedValueOnce(undefined);
    mockUseGroupDetail.mockReturnValue({
      data: makeGroupDetail({ createdById: "user-1" }),
      isLoading: false,
    });

    renderWithProviders();

    await act(async () => {
      fireEvent.click(screen.getByText("Delete group"));
    });

    // Alert mock auto-clicks last button (destructive "Delete")
    expect(mockDeleteGroupAsync).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/(app)/(dashboard)");
  });
});
