/**
 * Integration tests for Supabase configuration.
 *
 * These tests catch the "No API key found in request" error that occurs when
 * NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are not set —
 * most commonly because they haven't been added to the Vercel project environment.
 */

import { describe, it, expect } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe("Supabase environment variables", () => {
  it("NEXT_PUBLIC_SUPABASE_URL is set", () => {
    expect(url, "NEXT_PUBLIC_SUPABASE_URL is missing — set it in Vercel project settings").toBeTruthy();
  });

  it("NEXT_PUBLIC_SUPABASE_ANON_KEY is set", () => {
    expect(key, "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing — set it in Vercel project settings").toBeTruthy();
  });
});

describe("Supabase auth endpoint", () => {
  it("accepts the anon key (no 'No API key found' error)", async () => {
    if (!url || !key) {
      // Skip the HTTP check if env vars are absent — the test above already fails.
      return;
    }

    // /auth/v1/settings requires a valid apikey header.
    // This is the same authentication path used by auth.signUp() and auth.signInWithPassword().
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
    });

    const body = await response.json();

    expect(
      response.status,
      `Supabase rejected the API key with: ${JSON.stringify(body)} — check that NEXT_PUBLIC_SUPABASE_ANON_KEY is set correctly on Vercel (must include the NEXT_PUBLIC_ prefix)`
    ).toBe(200);
  });
});
