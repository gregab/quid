import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
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
    forceExit: true,
  },
});
