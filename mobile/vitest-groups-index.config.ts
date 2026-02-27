import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import type { Plugin } from "vite";

function imageAssetPlugin(): Plugin {
  return {
    name: "image-asset-stub",
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
      "@aviary/shared": path.resolve(__dirname, "../packages/shared/src"),
      "react-native": path.resolve(__dirname, "__mocks__/react-native.tsx"),
      "react-native-reanimated": path.resolve(__dirname, "__mocks__/react-native-reanimated.tsx"),
      "react-native-gesture-handler/ReanimatedSwipeable": path.resolve(__dirname, "__mocks__/react-native-gesture-handler.tsx"),
      "react-native-gesture-handler": path.resolve(__dirname, "__mocks__/react-native-gesture-handler.tsx"),
      "react-native-safe-area-context": path.resolve(__dirname, "__mocks__/react-native-safe-area-context.tsx"),
      [path.resolve(__dirname, "assets/birds.jpg")]: path.resolve(__dirname, "assets/birds.js"),
    },
  },
  test: {
    pool: "vmForks",
    environment: "happy-dom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "app/**/groups/**/index.test.tsx",
    ],
  },
});
