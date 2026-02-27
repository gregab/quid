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

export default defineConfig({
  plugins: [react(), imageAssetPlugin()],
  resolve: {
    alias: {
      // Shared package resolution
      "@aviary/shared": path.resolve(__dirname, "../packages/shared/src"),

      // Mock React Native modules → lightweight stubs (use .tsx for JSX transform)
      "react-native": path.resolve(__dirname, "__mocks__/react-native.tsx"),
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
      "react-native-safe-area-context": path.resolve(
        __dirname,
        "__mocks__/react-native-safe-area-context.tsx",
      ),

    },
  },
  test: {
    pool: "vmForks",
    environment: "happy-dom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "**/*.{test,spec}.?(c|m)[jt]s?(x)",
      // Explicitly include tests nested inside double-bracket Expo Router dirs.
      // Vitest's default glob treats [...] as character classes and misses these.
      "app/(app)/groups/\\[id\\]/expense/\\[expenseId\\]/*.test.tsx",
    ],
  },
});
