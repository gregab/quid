import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, Redirect } from "expo-router";
import { createTestQueryClient } from "../../../lib/test-utils";
import InviteScreen from "./[token]";

// Mock auth
const mockUseAuth = vi.fn();
vi.mock("../../../lib/auth", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseInvitePreview = vi.fn();
const mockJoinMutateAsync = vi.fn();

vi.mock("../../../lib/queries", () => ({
  useInvitePreview: () => mockUseInvitePreview(),
  useJoinGroup: () => ({
    mutateAsync: mockJoinMutateAsync,
    isPending: false,
  }),
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLocalSearchParams).mockReturnValue({ token: "invite-abc" });
  mockUseAuth.mockReturnValue({
    user: { id: "user-1" },
    session: { access_token: "tok" },
    loading: false,
    signOut: vi.fn(),
  });
});

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <InviteScreen />
    </QueryClientProvider>,
  );
}

describe("InviteScreen", () => {
  it("shows loading state", () => {
    mockUseInvitePreview.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    renderWithProviders();
    expect(screen.getByText("Loading invite...")).toBeTruthy();
  });

  it("shows invalid invite link on error", () => {
    mockUseInvitePreview.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Not found"),
    });
    renderWithProviders();
    expect(screen.getByText("Invalid invite link")).toBeTruthy();
    expect(screen.getByText("Go to dashboard")).toBeTruthy();
  });

  it("renders invite preview with group info", () => {
    mockUseInvitePreview.mockReturnValue({
      data: {
        id: "group-1",
        name: "Trip Group",
        memberCount: 4,
        isMember: false,
      },
      isLoading: false,
      error: null,
    });
    renderWithProviders();
    expect(screen.getByText("Trip Group")).toBeTruthy();
    expect(screen.getByText("4 members")).toBeTruthy();
    expect(
      screen.getByText("You've been invited to join this group on Aviary."),
    ).toBeTruthy();
    expect(screen.getByText("Join Trip Group")).toBeTruthy();
  });

  it("shows singular member text", () => {
    mockUseInvitePreview.mockReturnValue({
      data: {
        id: "group-1",
        name: "Solo",
        memberCount: 1,
        isMember: false,
      },
      isLoading: false,
      error: null,
    });
    renderWithProviders();
    expect(screen.getByText("1 member")).toBeTruthy();
  });

  it("calls joinGroup on button press", async () => {
    mockJoinMutateAsync.mockResolvedValueOnce({ groupId: "group-1" });
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
    } as unknown as ReturnType<typeof useRouter>);

    mockUseInvitePreview.mockReturnValue({
      data: {
        id: "group-1",
        name: "Trip Group",
        memberCount: 4,
        isMember: false,
      },
      isLoading: false,
      error: null,
    });
    renderWithProviders();

    await act(async () => {
      fireEvent.click(screen.getByText("Join Trip Group"));
    });

    expect(mockJoinMutateAsync).toHaveBeenCalledWith("invite-abc");
    expect(replace).toHaveBeenCalledWith(
      "/(app)/groups/group-1",
    );
  });

  it("shows error when join fails", async () => {
    mockJoinMutateAsync.mockRejectedValueOnce(
      new Error("Invite expired"),
    );
    mockUseInvitePreview.mockReturnValue({
      data: {
        id: "group-1",
        name: "Trip Group",
        memberCount: 4,
        isMember: false,
      },
      isLoading: false,
      error: null,
    });
    renderWithProviders();

    await act(async () => {
      fireEvent.click(screen.getByText("Join Trip Group"));
    });

    expect(screen.getByText("Invite expired")).toBeTruthy();
  });

  it("returns null (Redirect) when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signOut: vi.fn(),
    });
    mockUseInvitePreview.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    renderWithProviders();
    // Redirect component renders null in our mock
    expect(screen.queryByText("Join")).toBeNull();
  });
});
