/**
 * Tests for the Prisma client singleton and connection pool configuration.
 *
 * Key invariant: pg.Pool is created with max: 1 so each serverless function
 * instance holds at most one connection to the transaction pooler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures these are available when vi.mock factories execute (which are hoisted
// before imports at the top of the compiled test file).
// Note: constructors called with `new` must be plain vi.fn() — not mockReturnValue/arrow fns.
const { mockPoolConstructor, mockPrismaPg, mockPrismaClient } = vi.hoisted(() => ({
  mockPoolConstructor: vi.fn(),
  mockPrismaPg: vi.fn(),
  mockPrismaClient: vi.fn(),
}));

vi.mock("pg", () => ({ default: { Pool: mockPoolConstructor } }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: mockPrismaPg }));
vi.mock("@/app/generated/prisma/client", () => ({ PrismaClient: mockPrismaClient }));

describe("Prisma client pool configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear the globalThis singleton so each test starts with a fresh createPrismaClient call.
    (globalThis as Record<string, unknown>).prisma = undefined;
    mockPoolConstructor.mockClear();
    mockPrismaClient.mockClear();
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
  });

  it("creates pg.Pool with max: 1 to prevent serverless connection exhaustion", async () => {
    await import("./client");
    expect(mockPoolConstructor).toHaveBeenCalledOnce();
    expect(mockPoolConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ max: 1 })
    );
  });

  it("caches the Prisma client on globalThis so re-imports don't open new connections", async () => {
    await import("./client");
    // Simulate a module re-evaluation (dev hot-reload or edge-case re-import)
    vi.resetModules();
    await import("./client");
    // createPrismaClient — and therefore pg.Pool — should only run once
    expect(mockPrismaClient).toHaveBeenCalledOnce();
  });

  it("exports the same prisma instance on repeated imports (globalThis singleton)", async () => {
    await import("./client");
    const cachedClient = (globalThis as Record<string, unknown>).prisma;
    vi.resetModules();
    await import("./client");
    // Same object should be on globalThis — createPrismaClient not called again
    expect((globalThis as Record<string, unknown>).prisma).toBe(cachedClient);
    expect(mockPrismaClient).toHaveBeenCalledOnce();
  });
});
