/**
 * Production smoke tests for gregbigelow.com/quid
 *
 * These tests hit the live site and verify that the app is reachable and
 * behaving correctly after a deployment. Run them with:
 *
 *   npm test tests/smoke.test.ts
 *
 * They do NOT require local env vars — they test the deployed site directly.
 *
 * Authenticated tests require three additional env vars in .env.local:
 *   SMOKE_TEST_EMAIL     — email of a real test account
 *   SMOKE_TEST_PASSWORD  — password for that account
 *   NEXT_PUBLIC_SUPABASE_URL (already required by the app)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY (already required by the app)
 *
 * Skip all smoke tests in CI with no internet access:
 *   SKIP_SMOKE_TESTS=1
 */

import { describe, it, expect, beforeAll } from "vitest";

// The canonical domain (gregbigelow.com) redirects to www — use it directly.
const BASE = "https://www.gregbigelow.com/quid";
const API = `${BASE}/api`;

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
      body: { description: "smoke", amountCents: 100, date: "2026-01-01", paidByEmail: "nobody@example.com" },
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
