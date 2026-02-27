/**
 * Global test setup for mobile app.
 * Mocks native modules that aren't available in happy-dom.
 */
import { vi } from "vitest";

// --- @react-native-async-storage/async-storage ---
vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn((key: string) =>
        Promise.resolve(store.get(key) ?? null),
      ),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
        return Promise.resolve();
      }),
      clear: vi.fn(() => {
        store.clear();
        return Promise.resolve();
      }),
      _store: store,
    },
  };
});

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

// --- expo-web-browser ---
vi.mock("expo-web-browser", () => ({
  openAuthSessionAsync: vi.fn(() =>
    Promise.resolve({ type: "cancel" }),
  ),
  maybeCompleteAuthSession: vi.fn(),
}));

// --- expo-auth-session ---
vi.mock("expo-auth-session", () => ({
  makeRedirectUri: vi.fn(() => "aviary://redirect"),
}));

// --- expo-image-picker ---
vi.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: vi.fn(() =>
    Promise.resolve({ canceled: true, assets: [] }),
  ),
  MediaTypeOptions: { Images: "Images" },
}));

// --- react-native-gesture-handler/ReanimatedSwipeable ---
vi.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const React = require("react");
  return {
    default: ({ children, onSwipeableOpen, renderRightActions }: Record<string, unknown>) => {
      return React.createElement("div", { "data-testid": "swipeable" }, children);
    },
  };
});

// --- expo-router ---
vi.mock("expo-router", () => {
  const React = require("react");
  return {
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
    Redirect: ({ href }: { href: string }) =>
      React.createElement("div", { "data-testid": "redirect", "data-href": href }),
  };
});

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
      extra: {
        eas: { projectId: "test-project-id" },
      },
    },
  },
}));

// --- expo-notifications ---
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: vi.fn(() =>
    Promise.resolve({ status: "granted", expires: "never", granted: true }),
  ),
  requestPermissionsAsync: vi.fn(() =>
    Promise.resolve({ status: "granted", expires: "never", granted: true }),
  ),
  getExpoPushTokenAsync: vi.fn(() =>
    Promise.resolve({ data: "ExponentPushToken[mock-token]", type: "expo" }),
  ),
  setNotificationHandler: vi.fn(),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 },
}));

// --- expo-device ---
vi.mock("expo-device", () => ({
  isDevice: true,
}));

// --- expo-auth-session ---
vi.mock("expo-auth-session", () => ({
  makeRedirectUri: vi.fn(() => "aviary://auth/callback"),
}));

// --- expo-web-browser ---
vi.mock("expo-web-browser", () => ({
  openAuthSessionAsync: vi.fn(() =>
    Promise.resolve({ type: "success", url: "aviary://auth/callback" }),
  ),
  maybeCompleteAuthSession: vi.fn(),
  warmUpAsync: vi.fn(() => Promise.resolve()),
  coolDownAsync: vi.fn(() => Promise.resolve()),
}));

// --- expo-crypto ---
vi.mock("expo-crypto", () => ({
  getRandomBytesAsync: vi.fn((size: number) =>
    Promise.resolve(new Uint8Array(size)),
  ),
  digestStringAsync: vi.fn(() => Promise.resolve("mock-hash")),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));

// --- @react-native-community/netinfo ---
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    addEventListener: vi.fn(() => vi.fn()),
    fetch: vi.fn(() =>
      Promise.resolve({ isConnected: true, isInternetReachable: true }),
    ),
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

// --- react-native-svg ---
vi.mock("react-native-svg", () => ({
  SvgXml: () => null,
  Svg: () => null,
  Path: () => null,
  Rect: () => null,
  Circle: () => null,
}));

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
        signInWithOAuth: vi.fn().mockResolvedValue({
          data: { url: "https://accounts.google.com/o/oauth2/auth?...", provider: "google" },
          error: null,
        }),
        resetPasswordForEmail: vi.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
        setSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
        exchangeCodeForSession: vi.fn().mockResolvedValue({
          data: { session: null },
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
