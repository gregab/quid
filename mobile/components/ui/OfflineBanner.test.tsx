import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

let mockIsConnected = true;
vi.mock("../../lib/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ isConnected: mockIsConnected }),
}));

// Override useAnimatedStyle to return empty style (RN transforms aren't valid CSS)
vi.mock("react-native-reanimated", async () => {
  const actual = await vi.importActual<typeof import("react-native-reanimated")>(
    "react-native-reanimated",
  );
  return {
    ...actual,
    useAnimatedStyle: () => ({}),
  };
});

import { OfflineBanner } from "./OfflineBanner";

afterEach(cleanup);

beforeEach(() => {
  mockIsConnected = true;
});

describe("OfflineBanner", () => {
  it("renders the banner text when online (animated off-screen)", () => {
    mockIsConnected = true;
    render(<OfflineBanner />);
    expect(screen.getByText("No internet connection")).toBeTruthy();
  });

  it("shows 'No internet connection' when offline", () => {
    mockIsConnected = false;
    render(<OfflineBanner />);
    expect(screen.getByText("No internet connection")).toBeTruthy();
  });

  it("renders the dot indicator when offline", () => {
    mockIsConnected = false;
    render(<OfflineBanner />);
    expect(screen.getByText("●")).toBeTruthy();
  });
});
