import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, makeGroup } from "../../../lib/test-utils";
import DashboardScreen from "./index";

// lucide-react-native must be mocked at test level — the Proxy mock in
// vitest.setup.ts doesn't prevent the real module (which depends on
// react-native-svg) from loading and hanging the test.
vi.mock("lucide-react-native", () => ({
  ChevronRight: () => null,
  Plus: () => null,
  Settings: () => null,
  UserPlus: () => null,
}));

// Mock auth
vi.mock("../../../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: "user-1",
      email: "alice@example.com",
      user_metadata: { display_name: "Alice" },
    },
    session: { access_token: "tok" },
    loading: false,
    signOut: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock queries
const mockUseGroups = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseContacts = vi.fn();

vi.mock("../../../lib/queries", () => ({
  useGroups: () => mockUseGroups(),
  useCurrentUser: () => mockUseCurrentUser(),
  useContacts: () => mockUseContacts(),
}));

afterEach(cleanup);

function renderWithProviders() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <DashboardScreen />
    </QueryClientProvider>,
  );
}

describe("DashboardScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentUser.mockReturnValue({
      data: { displayName: "Alice" },
      isLoading: false,
    });
    mockUseContacts.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it("shows loading spinner when groups are loading", () => {
    mockUseGroups.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Loading groups...")).toBeTruthy();
  });

  it("shows empty state when no groups", () => {
    mockUseGroups.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Welcome to the nest")).toBeTruthy();
    expect(screen.getByText("Create your first group")).toBeTruthy();
  });

  it("renders group cards when groups exist", () => {
    mockUseGroups.mockReturnValue({
      data: [
        makeGroup({ id: "g1", name: "Roommates", memberCount: 3, balanceCents: 0 }),
        makeGroup({ id: "g2", name: "Trip", memberCount: 2, balanceCents: -1500 }),
      ],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Roommates")).toBeTruthy();
    expect(screen.getByText("Trip")).toBeTruthy();
    expect(screen.getByText("3 members")).toBeTruthy();
    expect(screen.getByText("2 members")).toBeTruthy();
  });

  it("shows positive balance as 'you are owed'", () => {
    mockUseGroups.mockReturnValue({
      data: [makeGroup({ balanceCents: 2500 })],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("you are owed")).toBeTruthy();
    expect(screen.getByText("$25.00")).toBeTruthy();
  });

  it("shows negative balance as 'you owe'", () => {
    mockUseGroups.mockReturnValue({
      data: [makeGroup({ balanceCents: -1000 })],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("you owe")).toBeTruthy();
    expect(screen.getByText("$10.00")).toBeTruthy();
  });

  it("shows settled up message when total balance is zero", () => {
    mockUseGroups.mockReturnValue({
      data: [makeGroup({ balanceCents: 0 })],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("You're all settled up!")).toBeTruthy();
  });

  it("displays hero card with user greeting", () => {
    mockUseGroups.mockReturnValue({
      data: [makeGroup()],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Hey Alice.")).toBeTruthy();
  });

  it("shows bird fact section when groups exist", () => {
    mockUseGroups.mockReturnValue({
      data: [makeGroup()],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Bird fact")).toBeTruthy();
  });

  it("does not show bird fact when no groups", () => {
    mockUseGroups.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.queryByText("Bird fact")).toBeNull();
  });

  it("renders 'Aviary' branding", () => {
    mockUseGroups.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("Aviary")).toBeTruthy();
  });

  it("shows New group button", () => {
    mockUseGroups.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
    renderWithProviders();
    expect(screen.getByText("New group")).toBeTruthy();
  });
});
