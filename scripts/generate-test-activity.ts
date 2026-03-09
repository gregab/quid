#!/usr/bin/env npx tsx
/**
 * Generate test activity against the Aviary production API.
 *
 * This script creates a group, adds a batch of expenses with varied
 * descriptions and amounts, then cleans up after itself. It exercises
 * the Supabase database to prevent the free-tier project from pausing
 * due to inactivity.
 *
 * Usage:
 *   SMOKE_TEST_EMAIL=you@example.com \
 *   SMOKE_TEST_PASSWORD=secret \
 *   NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
 *   npx tsx scripts/generate-test-activity.ts
 *
 * Or with .env.local populated:
 *   npx tsx --env-file=.env.local scripts/generate-test-activity.ts
 */

const BASE = process.env.SMOKE_TEST_BASE_URL ?? "https://aviary.gregbigelow.com";
const API = `${BASE}/api`;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";
const testEmail = process.env.SMOKE_TEST_EMAIL ?? "";
const testPassword = process.env.SMOKE_TEST_PASSWORD ?? "";

if (!testEmail || !testPassword || !supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing required env vars: SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Auth helper (same as smoke tests)
// ---------------------------------------------------------------------------

async function getAuthCookie(): Promise<string> {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase sign-in failed (${res.status}): ${body}`);
  }

  const session = (await res.json()) as Record<string, unknown>;
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = encodeURIComponent(JSON.stringify(session));
  return `${cookieName}=${cookieValue}`;
}

async function callApi(
  method: string,
  path: string,
  body: object | undefined,
  cookie: string
): Promise<Response> {
  return fetch(`${API}${path}`, {
    method,
    redirect: "manual",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const EXPENSE_TEMPLATES = [
  { description: "Groceries — Trader Joe's", amountCents: 4523 },
  { description: "Gas station fill-up", amountCents: 5800 },
  { description: "Pizza night", amountCents: 3200 },
  { description: "Netflix subscription", amountCents: 1599 },
  { description: "Uber ride downtown", amountCents: 2475 },
  { description: "Coffee and pastries", amountCents: 1850 },
  { description: "Electric bill — March", amountCents: 11200 },
  { description: "Gym membership", amountCents: 4999 },
  { description: "Concert tickets", amountCents: 15000 },
  { description: "Dinner at Thai place", amountCents: 6730 },
  { description: "Airbnb weekend trip", amountCents: 25000 },
  { description: "Costco run", amountCents: 18945 },
  { description: "Parking garage", amountCents: 1500 },
  { description: "Brunch", amountCents: 4200 },
  { description: "Dog walker", amountCents: 3500 },
];

function randomDate(): string {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 60);
  const d = new Date(now.getTime() - daysAgo * 86400000);
  return d.toISOString().split("T")[0]!;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Generating test activity against ${BASE}...`);

  const cookie = await getAuthCookie();
  console.log("Authenticated successfully.");

  // 1. Create a test group
  const groupRes = await callApi("POST", "/groups", { name: "[test activity — safe to delete]" }, cookie);
  if (groupRes.status !== 201) {
    const text = await groupRes.text();
    throw new Error(`Failed to create group (${groupRes.status}): ${text}`);
  }
  const groupBody = (await groupRes.json()) as { data: { id: string; name: string } };
  const groupId = groupBody.data.id;
  console.log(`Created group: ${groupBody.data.name} (${groupId})`);

  // 2. Add expenses
  const createdExpenseIds: string[] = [];
  for (const template of EXPENSE_TEMPLATES) {
    const date = randomDate();
    const res = await callApi(
      "POST",
      `/groups/${groupId}/expenses`,
      { description: template.description, amountCents: template.amountCents, date },
      cookie
    );
    if (res.status !== 201) {
      const text = await res.text();
      console.error(`Failed to create expense "${template.description}" (${res.status}): ${text}`);
      continue;
    }
    const body = (await res.json()) as { data: { id: string } };
    createdExpenseIds.push(body.data.id);
    console.log(`  + ${template.description} — $${(template.amountCents / 100).toFixed(2)} on ${date}`);
  }

  console.log(`\nCreated ${createdExpenseIds.length} expenses.`);

  // 3. Read balances (exercises the balance calculation path)
  const balRes = await callApi("GET", `/groups/${groupId}/balances`, undefined, cookie);
  if (balRes.status === 200) {
    const balBody = (await balRes.json()) as { data: unknown[] };
    console.log(`Balances computed: ${balBody.data.length} debt(s).`);
  }

  // 4. Update a few expenses (exercises update path)
  for (const expenseId of createdExpenseIds.slice(0, 3)) {
    const res = await callApi(
      "PUT",
      `/groups/${groupId}/expenses/${expenseId}`,
      { description: "[updated] test expense", amountCents: 9999, date: randomDate() },
      cookie
    );
    if (res.status === 200) {
      console.log(`  ~ Updated expense ${expenseId}`);
    }
  }

  // 5. Delete a few expenses (exercises delete path)
  for (const expenseId of createdExpenseIds.slice(0, 2)) {
    const res = await callApi("DELETE", `/groups/${groupId}/expenses/${expenseId}`, undefined, cookie);
    if (res.status === 200) {
      console.log(`  - Deleted expense ${expenseId}`);
    }
  }

  // 6. Read balances again after mutations
  const balRes2 = await callApi("GET", `/groups/${groupId}/balances`, undefined, cookie);
  if (balRes2.status === 200) {
    const balBody2 = (await balRes2.json()) as { data: unknown[] };
    console.log(`Final balances: ${balBody2.data.length} debt(s).`);
  }

  // 7. Clean up — leave group (last member leaving deletes the group)
  const leaveRes = await callApi("DELETE", `/groups/${groupId}/members`, undefined, cookie);
  if (leaveRes.status === 200) {
    console.log(`\nCleaned up: left and deleted group ${groupId}.`);
  } else {
    console.warn(`Warning: could not leave group (${leaveRes.status}).`);
  }

  console.log("\nDone! Database has been exercised.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
