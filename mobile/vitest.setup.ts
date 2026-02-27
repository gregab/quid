/**
 * Global test setup for mobile app.
 * Mocks native modules that aren't available in happy-dom.
 */
import { vi } from "vitest";

// --- expo-secure-store ---
vi.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: vi.fn((key: string) =>
      Promise.resolve(store.get(key) ?? null),
    ),
    setItemAsync: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

// --- expo-haptics ---
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(() => Promise.resolve()),
  notificationAsync: vi.fn(() => Promise.resolve()),
  selectionAsync: vi.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

// --- expo-font ---
vi.mock("expo-font", () => ({
  useFonts: vi.fn(() => [true, null]),
  isLoaded: vi.fn(() => true),
  loadAsync: vi.fn(() => Promise.resolve()),
}));

// --- expo-splash-screen ---
vi.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: vi.fn(() => Promise.resolve()),
  hideAsync: vi.fn(() => Promise.resolve()),
}));

// --- expo-clipboard ---
vi.mock("expo-clipboard", () => ({
  setStringAsync: vi.fn(() => Promise.resolve()),
  getStringAsync: vi.fn(() => Promise.resolve("")),
}));

// --- expo-router ---
vi.mock("expo-router", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    canGoBack: vi.fn(() => true),
  })),
  useLocalSearchParams: vi.fn(() => ({})),
  useSegments: vi.fn(() => []),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: Object.assign(
    ({ children }: { children: React.ReactNode }) => children,
    { Screen: () => null },
  ),
  Slot: () => null,
}));

// --- expo-status-bar ---
vi.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

// --- expo-linking ---
vi.mock("expo-linking", () => ({
  createURL: vi.fn((path: string) => `aviary://${path}`),
  openURL: vi.fn(() => Promise.resolve()),
}));

// --- expo-constants ---
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      name: "Aviary",
      slug: "aviary",
      scheme: "aviary",
    },
  },
}));

// --- @gorhom/bottom-sheet ---
vi.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
  BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  BottomSheetView: ({ children }: { children: React.ReactNode }) => children,
  BottomSheetBackdrop: () => null,
}));

// --- @react-native-community/datetimepicker ---
vi.mock("@react-native-community/datetimepicker", () => ({
  default: () => null,
}));

// --- lucide-react-native ---
vi.mock("lucide-react-native", () => {
  return new Proxy(
    {},
    {
      get: (_target, name) => {
        if (typeof name === "string") {
          // Return a simple component stub for any icon
          return (props: Record<string, unknown>) => {
            const React = require("react");
            return React.createElement("span", {
              "data-testid": `icon-${name}`,
              ...props,
            });
          };
        }
        return undefined;
      },
    },
  );
});

// --- lib/toast ---
vi.mock("./lib/toast", () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
  })),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// --- Supabase client (default mock — tests can override) ---
vi.mock("./lib/supabase", () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  return {
    supabase: {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
        signUp: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
      from: vi.fn(() => mockChain),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
});
