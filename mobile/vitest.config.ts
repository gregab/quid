import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import type { Plugin } from "vite";

/** Transform image/asset requires (e.g. require('./foo.jpg')) to a stub string. */
function imageAssetPlugin(): Plugin {
  return {
    name: "image-asset-stub",
    // `load` runs before transform and can intercept binary files
    load(id) {
      if (/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/.test(id)) {
        return "module.exports = 1;";
      }
    },
    transform(_code, id) {
      if (/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/.test(id)) {
        return { code: "module.exports = 1;", map: null };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Alias strategy for native/Expo packages
// ---------------------------------------------------------------------------
//
// When running from a git worktree (.claude/worktrees/{name}/mobile), the
// worktree's mobile/node_modules only exists as an empty directory — the real
// packages live in the main workspace's mobile/node_modules, which is not on
// the Node resolution path from the worktree.
//
// Vite's import-analysis plugin resolves ALL imports at TRANSFORM time
// (before any test code runs). If it can't find a package, it hard-fails with
// "Failed to resolve import" even if vi.mock() would intercept it at runtime.
//
// Solution: every native/Expo package gets a resolve.alias pointing to a thin
// stub file in __mocks__/. The stub satisfies vite's transform-time resolver.
// The vi.mock() calls in vitest.setup.ts then override the stub at runtime
// with proper vi.fn() mocks so tests can assert on calls.
//
// This also applies in the main workspace for packages that can't run in
// happy-dom (native binaries, JSI modules, etc.).
//
// LUCIDE NOTE: Do NOT use a vi.mock() Proxy factory for lucide-react-native.
// A Proxy without ownKeys causes vitest to fall back to loading the real
// 1700-line barrel, which hangs indefinitely. The named-export stub + alias
// is the only correct approach for lucide.
//
// ADDING A NEW NATIVE PACKAGE:
//   1. Create __mocks__/<package-name>.ts (or .tsx) with minimal stub exports
//   2. Add a resolve.alias entry below
//   3. Add a vi.mock('<package-name>', factory) in vitest.setup.ts for runtime
// ---------------------------------------------------------------------------

export default defineConfig({
  plugins: [react(), imageAssetPlugin()],
  resolve: {
    alias: {
      // Shared package
      "@aviary/shared": path.resolve(__dirname, "../packages/shared/src"),

      // --- React (pin to single copy — prevents "Invalid hook call" when packages
      //     like @tanstack/react-query load from mobile/node_modules which has its
      //     own React copy) ---
      "react/jsx-dev-runtime": path.resolve(
        __dirname,
        "../../../../node_modules/react/jsx-dev-runtime",
      ),
      "react/jsx-runtime": path.resolve(
        __dirname,
        "../../../../node_modules/react/jsx-runtime",
      ),
      "react": path.resolve(__dirname, "../../../../node_modules/react"),

      // --- React Native core ---
      "react-native": path.resolve(__dirname, "__mocks__/react-native.tsx"),

      // --- Animation / Gesture ---
      "react-native-reanimated": path.resolve(
        __dirname,
        "__mocks__/react-native-reanimated.tsx",
      ),
      "react-native-gesture-handler/ReanimatedSwipeable": path.resolve(
        __dirname,
        "__mocks__/react-native-gesture-handler.tsx",
      ),
      "react-native-gesture-handler": path.resolve(
        __dirname,
        "__mocks__/react-native-gesture-handler.tsx",
      ),

      // --- Safe area / UI primitives ---
      "react-native-safe-area-context": path.resolve(
        __dirname,
        "__mocks__/react-native-safe-area-context.tsx",
      ),
      "react-native-svg": path.resolve(__dirname, "__mocks__/react-native-svg.tsx"),

      // --- Third-party RN ---
      "@gorhom/bottom-sheet": path.resolve(
        __dirname,
        "__mocks__/@gorhom/bottom-sheet.tsx",
      ),
      "@react-native-async-storage/async-storage": path.resolve(
        __dirname,
        "__mocks__/@react-native-async-storage/async-storage.ts",
      ),
      "@react-native-community/datetimepicker": path.resolve(
        __dirname,
        "__mocks__/@react-native-community/datetimepicker.tsx",
      ),
      "@react-native-community/netinfo": path.resolve(
        __dirname,
        "__mocks__/@react-native-community/netinfo.ts",
      ),

      // --- Expo packages ---
      "expo-router": path.resolve(__dirname, "__mocks__/expo-router.tsx"),
      "expo-status-bar": path.resolve(__dirname, "__mocks__/expo-status-bar.tsx"),
      "expo-haptics": path.resolve(__dirname, "__mocks__/expo-haptics.ts"),
      "expo-linking": path.resolve(__dirname, "__mocks__/expo-linking.ts"),
      "expo-constants": path.resolve(__dirname, "__mocks__/expo-constants.ts"),
      "expo-device": path.resolve(__dirname, "__mocks__/expo-device.ts"),
      "expo-notifications": path.resolve(
        __dirname,
        "__mocks__/expo-notifications.ts",
      ),
      "expo-splash-screen": path.resolve(
        __dirname,
        "__mocks__/expo-splash-screen.ts",
      ),
      "expo-secure-store": path.resolve(
        __dirname,
        "__mocks__/expo-secure-store.ts",
      ),
      "expo-auth-session": path.resolve(
        __dirname,
        "__mocks__/expo-auth-session.ts",
      ),
      "expo-web-browser": path.resolve(
        __dirname,
        "__mocks__/expo-web-browser.ts",
      ),
      "expo-font": path.resolve(__dirname, "__mocks__/expo-font.ts"),
      "expo-image-picker": path.resolve(
        __dirname,
        "__mocks__/expo-image-picker.ts",
      ),
      "expo-crypto": path.resolve(__dirname, "__mocks__/expo-crypto.ts"),
      "expo-clipboard": path.resolve(__dirname, "__mocks__/expo-clipboard.ts"),

      // --- TanStack (mobile-only, not hoisted to root) ---
      "@tanstack/react-query": path.resolve(
        __dirname,
        "../../../../mobile/node_modules/@tanstack/react-query/build/legacy/index.js",
      ),
      "@tanstack/query-core": path.resolve(
        __dirname,
        "../../../../mobile/node_modules/@tanstack/query-core/build/legacy/index.js",
      ),

      // --- Icons (see LUCIDE NOTE above) ---
      "lucide-react-native": path.resolve(
        __dirname,
        "__mocks__/lucide-react-native.ts",
      ),
    },
  },
  test: {
    pool: "vmForks",
    environment: "happy-dom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    // Force process exit after all tests complete — prevents hanging due to
    // dangling async ops (TanStack Query timers, happy-dom, etc.)
    forceExit: true,
    include: [
      "**/*.{test,spec}.?(c|m)[jt]s?(x)",
      // Explicitly include tests nested inside double-bracket Expo Router dirs.
      // Vitest's default glob treats [...] as character classes and misses these.
      "app/(app)/groups/\\[id\\]/expense/\\[expenseId\\]/*.test.tsx",
    ],
    server: {
      deps: {
        // Inline packages loaded from mobile/node_modules so that vite's
        // resolve.alias applies to their internal imports (particularly React).
        // Without inlining, Node's native ESM loader resolves "react" relative
        // to the package's own directory and finds the duplicate mobile React.
        inline: [/@tanstack\/react-query/, /@tanstack\/query-core/],
      },
    },
  },
});
