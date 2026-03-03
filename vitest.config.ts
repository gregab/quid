import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@aviary/shared": path.resolve(__dirname, "packages/shared/src"),
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    exclude: ["node_modules", ".claude/worktrees/**"],
  },
});
