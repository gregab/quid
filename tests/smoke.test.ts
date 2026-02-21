/**
 * Smoke tests for quid — run against production or a local dev server.
 *
 * Against production (default):
 *   npm test tests/smoke.test.ts
 *
 * Against a local dev server (vercel dev or npm run dev):
 *   SMOKE_TEST_BASE_URL=http://localhost:3000/quid npm test tests/smoke.test.ts
 *
 * Authenticated tests require these env vars in .env.local:
 *   SMOKE_TEST_EMAIL     — email of a real test account
 *   SMOKE_TEST_PASSWORD  — password for that account
 *   NEXT_PUBLIC_SUPABASE_URL (already required by the app)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY (already required by the app)
 *
 * Skip all smoke tests (e.g. in CI with no network):
 *   SKIP_SMOKE_TESTS=1
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.SMOKE_TEST_BASE_URL ?? "https://www.gregbigelow.com/quid";
const API = `${BASE}/api`;
const isLocal = BASE.startsWith("http://localhost") || BASE.startsWith("http://127.");

const skipAll = process.env.SKIP_SMOKE_TESTS === "1";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";
const testEmail = process.env.SMOKE_TEST_EMAIL ?? "";
const testPassword = process.env.SMOKE_TEST_PASSWORD ?? "";

const hasTestCredentials = !!(testEmail && testPassword && supabaseUrl && supabaseAnonKey);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** GET a page URL, optionally following all redirects. */
async function getPage(path: string, opts: RequestInit & { followRedirects?: boolean } = {}) {
  const { followRedirects = false, ...rest } = opts;
  return fetch(`${BASE}${path}`, { redirect: followRedirects ? "follow" : "manual", ...rest });
}

/** Call an API endpoint without following redirects. */
async function callApi(method: string, path: string, body?: object, headers?: Record<string, string>) {
  return fetch(`${API}${path}`, {
    method,
    redirect: "manual",
    headers: { "Content-Type": "application/json", ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

/**
 * Sign in via the Supabase auth REST API and return an auth cookie string.
 * The @supabase/ssr library reads sessions from a cookie named
 * `sb-{projectRef}-auth-token` whose value is the raw session JSON.
 */
async function getAuthCookie(): Promise<string> {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase sign-in failed (${res.status}): ${body}`);
  }

  const session = await res.json() as Record<string, unknown>;

  // Derive the project ref from the Supabase URL (e.g. https://xyz123.supabase.co → xyz123)
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;

  // @supabase/ssr stores the session as the raw JSON string.
  // We URL-encode it to safely embed it in a Cookie header.
  const cookieValue = encodeURIComponent(JSON.stringify(session));
  return `${cookieName}=${cookieValue}`;
}

// ---------------------------------------------------------------------------
// Site reachability
// ---------------------------------------------------------------------------

describe.skipIf(skipAll)("site reachability", () => {
  it("root URL responds with 2xx", async () => {
    const res = await getPage("", { followRedirects: true });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(400);
  });

  it("login page is publicly accessible and returns HTML", async () => {
    const res = await getPage("/login", { followRedirects: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/i);
    const html = await res.text();
    expect(html.toLowerCase()).toMatch(/log.?in|sign.?in|email/i);
  });

  it("signup page is publicly accessible and returns HTML", async () => {
    const res = await getPage("/signup", { followRedirects: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/i);
    const html = await res.text();
    expect(html.toLowerCase()).toMatch(/sign.?up|create.?account|email/i);
  });
});

// ---------------------------------------------------------------------------
// Auth protection — proxy.ts redirects unauthenticated page requests to /login
// ---------------------------------------------------------------------------

describe.skipIf(skipAll)("auth-protected pages redirect unauthenticated users to login", () => {
  const protectedPaths = [
    "/dashboard",
    "/groups/00000000-0000-0000-0000-000000000001",
  ];

  for (const path of protectedPaths) {
    it(`GET ${path} → ends up at /login`, async () => {
      const res = await getPage(path, { followRedirects: true });
      expect(res.status).toBe(200);
      expect(res.url).toMatch(/login/i);
    });
  }
});

// ---------------------------------------------------------------------------
// basePath sanity — routes must not exist at the root domain (without /quid)
//
// Next.js serves the app under basePath: "/quid". Client-side code that uses
// raw fetch("/api/...") or <a href="/groups/..."> bypasses this and hits the
// root domain instead. These tests verify that the root-level paths return
// 404 so any regression immediately shows up as a broken client action.
// ---------------------------------------------------------------------------

describe.skipIf(skipAll || isLocal)("basePath sanity: routes only exist under /quid, not at root", () => {
  const ROOT = "https://www.gregbigelow.com";

  const rootPaths = [
    { method: "GET",  path: "/api/groups" },
    { method: "POST", path: "/api/groups" },
    { method: "POST",   path: "/api/groups/00000000-0000-0000-0000-000000000001/members" },
    { method: "POST",   path: "/api/groups/00000000-0000-0000-0000-000000000001/expenses" },
    { method: "PUT",    path: "/api/groups/00000000-0000-0000-0000-000000000001/expenses/00000000-0000-0000-0000-000000000002" },
    { method: "DELETE", path: "/api/groups/00000000-0000-0000-0000-000000000001/expenses/00000000-0000-0000-0000-000000000002" },
    { method: "GET",    path: "/api/groups/00000000-0000-0000-0000-000000000001/balances" },
  ];

  for (const { method, path } of rootPaths) {
    it(`${method} ${ROOT}${path} → 404 (no route exists without basePath)`, async () => {
      const res = await fetch(`${ROOT}${path}`, {
        method,
        redirect: "manual",
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(404);
    });
  }
});

// ---------------------------------------------------------------------------
// API endpoints — unauthenticated
// proxy.ts only protects page routes; /api/* routes check auth themselves.
// ---------------------------------------------------------------------------

describe.skipIf(skipAll)("API endpoints: unauthenticated requests return 401", () => {
  const cases: Array<{ method: string; path: string; body?: object }> = [
    { method: "GET",  path: "/groups" },
    { method: "POST", path: "/groups", body: { name: "smoke-test-group" } },
    {
      method: "POST",
      path: "/groups/00000000-0000-0000-0000-000000000001/members",
      body: { email: "nobody@example.com" },
    },
    {
      method: "POST",
      path: "/groups/00000000-0000-0000-0000-000000000001/expenses",
      body: { description: "smoke", amountCents: 100, date: "2026-01-01" },
    },
    {
      method: "PUT",
      path: "/groups/00000000-0000-0000-0000-000000000001/expenses/00000000-0000-0000-0000-000000000002",
      body: { description: "smoke edited", amountCents: 200, date: "2026-01-01" },
    },
    {
      method: "DELETE",
      path: "/groups/00000000-0000-0000-0000-000000000001/expenses/00000000-0000-0000-0000-000000000002",
    },
    { method: "GET", path: "/groups/00000000-0000-0000-0000-000000000001/balances" },
  ];

  for (const { method, path, body } of cases) {
    it(`${method} /api${path} → 401`, async () => {
      const res = await callApi(method, path, body);
      expect(res.status).toBe(401);
    });
  }
});

// ---------------------------------------------------------------------------
// API endpoints — authenticated
// Requires SMOKE_TEST_EMAIL + SMOKE_TEST_PASSWORD in .env.local.
// ---------------------------------------------------------------------------

describe.skipIf(skipAll || !hasTestCredentials)(
  "API endpoints: authenticated requests succeed",
  () => {
    let authCookie: string;
    let createdGroupId: string | undefined;
    let createdExpenseId: string | undefined;

    beforeAll(async () => {
      authCookie = await getAuthCookie();
    });

    it("GET /api/groups → 200 with { data: [], error: null } shape", async () => {
      const res = await callApi("GET", "/groups", undefined, { Cookie: authCookie });
      expect(res.status).toBe(200);
      const body = await res.json() as { data: unknown; error: unknown };
      expect(body).toMatchObject({ error: null });
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("POST /api/groups → 201, creates group and returns it", async () => {
      const res = await callApi(
        "POST",
        "/groups",
        { name: "[smoke test — safe to delete]" },
        { Cookie: authCookie }
      );
      expect(res.status).toBe(201);
      const body = await res.json() as { data: { id: string; name: string } | null; error: unknown };
      expect(body.error).toBeNull();
      expect(body.data).toBeDefined();
      expect(body.data?.name).toBe("[smoke test — safe to delete]");
      createdGroupId = body.data?.id;
    });

    it("dashboard HTML group links contain /quid/ basePath prefix", async () => {
      const res = await fetch(`${BASE}/dashboard`, {
        headers: { Cookie: authCookie },
        redirect: "follow",
      });
      expect(res.status).toBe(200);
      const html = await res.text();

      // Extract all href values from the rendered HTML
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
      const groupHrefs = hrefs.filter((h) => /\/groups\/[0-9a-f-]{36}/.test(h));

      // If the dashboard shows groups (it will after the create test above),
      // every group link must start with /quid/ — not /groups/ (bare path).
      if (groupHrefs.length > 0) {
        for (const href of groupHrefs) {
          expect(href).toMatch(/^\/quid\/groups\//);
        }
      }
    });

    it("GET /api/groups/:id/balances → 200 for own group", async () => {
      if (!createdGroupId) {
        // If group creation failed above, skip this dependent check
        return;
      }
      const res = await callApi(
        "GET",
        `/groups/${createdGroupId}/balances`,
        undefined,
        { Cookie: authCookie }
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { data: unknown[]; error: unknown };
      expect(body.error).toBeNull();
      expect(Array.isArray(body.data)).toBe(true);
      // New empty group has no expenses → no debts
      expect(body.data).toHaveLength(0);
    });

    it("POST /api/groups/:id/expenses → 201, creates expense", async () => {
      if (!createdGroupId) return;
      const res = await callApi(
        "POST",
        `/groups/${createdGroupId}/expenses`,
        { description: "[smoke test expense]", amountCents: 1000, date: "2026-01-01" },
        { Cookie: authCookie }
      );
      expect(res.status).toBe(201);
      const body = await res.json() as { data: { id: string; description: string; amountCents: number } | null; error: unknown };
      expect(body.error).toBeNull();
      expect(body.data?.description).toBe("[smoke test expense]");
      expect(body.data?.amountCents).toBe(1000);
      createdExpenseId = body.data?.id;
    });

    it("PUT /api/groups/:id/expenses/:expenseId → 200, updates expense", async () => {
      if (!createdGroupId || !createdExpenseId) return;
      const res = await callApi(
        "PUT",
        `/groups/${createdGroupId}/expenses/${createdExpenseId}`,
        { description: "[smoke test expense — edited]", amountCents: 2000, date: "2026-01-02" },
        { Cookie: authCookie }
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { data: { description: string; amountCents: number } | null; error: unknown };
      expect(body.error).toBeNull();
      expect(body.data?.description).toBe("[smoke test expense — edited]");
      expect(body.data?.amountCents).toBe(2000);
    });

    it("DELETE /api/groups/:id/expenses/:expenseId → 200, deletes expense", async () => {
      if (!createdGroupId || !createdExpenseId) return;
      const res = await callApi(
        "DELETE",
        `/groups/${createdGroupId}/expenses/${createdExpenseId}`,
        undefined,
        { Cookie: authCookie }
      );
      expect(res.status).toBe(200);
      const body = await res.json() as { data: null; error: unknown };
      expect(body.error).toBeNull();
    });

    it("GET /api/groups/:id/balances → 403 for a group user is not a member of", async () => {
      const res = await callApi(
        "GET",
        "/groups/00000000-0000-0000-0000-000000000001/balances",
        undefined,
        { Cookie: authCookie }
      );
      // 403 if the UUID exists but user isn't a member; 403 is still correct
      // (UUID is a placeholder that won't match any real group)
      expect([403, 404]).toContain(res.status);
    });
  }
);
