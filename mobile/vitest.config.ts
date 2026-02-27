import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Force root React to avoid version mismatch (mobile declares React 18 for RN, tests use react-dom 19)
      react: path.resolve(__dirname, "../node_modules/react"),
      "react-dom": path.resolve(__dirname, "../node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "../node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "../node_modules/react/jsx-dev-runtime"),

      // Shared package resolution
      "@aviary/shared": path.resolve(__dirname, "../packages/shared/src"),

      // Mock React Native modules → lightweight stubs (use .tsx for JSX transform)
      "react-native": path.resolve(__dirname, "__mocks__/react-native.tsx"),
      "react-native-reanimated": path.resolve(
        __dirname,
        "__mocks__/react-native-reanimated.tsx",
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
    // threads pool runs workers in Node.js worker threads (same process),
    // eliminating orphaned OS child processes that cause post-test hangs
    // with Vitest 4's default forks pool in monorepo setups.
    pool: "vmForks",
    environment: "happy-dom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    forceExit: true,
  },
});
