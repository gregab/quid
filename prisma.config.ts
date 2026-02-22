import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local first (Next.js convention), then fall back to .env
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need the direct connection (port 5432), not the transaction pooler.
    // DIRECT_URL is the primary; fall back to legacy Vercel-provisioned var names.
    url: process.env["DIRECT_URL"] ?? process.env["POSTGRES_URL_NON_POOLING"] ?? process.env["DATABASE_URL"],
  },
});
