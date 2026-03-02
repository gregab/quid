/**
 * Recurring expenses E2E tests.
 *
 * Covers the full lifecycle: create → badge shows → cron generates next instance
 * → stop → cron skips stopped templates.
 *
 * Requires a running dev server: npm run dev
 * Requires cypress.env.json with SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, CRON_SECRET.
 *
 * The cron tests use a backdated firstDate (3 months ago) so nextDueDate is
 * already in the past and process_due_recurring_expenses picks it up immediately.
 */

// firstDate for backdated monthly recurring expenses.
// Must satisfy two constraints:
//   1. firstDate + 1 month <= today  →  cron picks it up on the first run
//   2. firstDate + 2 months > today  →  after one cron advance, nextDueDate is
//      in the future so later tests' cron calls don't re-process it
// With today = 2026-02-23, "2026-01-15" works: nextDueDate = 2026-02-15 (due),
// after one advance → 2026-03-15 (future).
const BACKDATED_FIRST_DATE = "2026-01-15";

describe("recurring expenses", () => {
  let groupId: string;

  beforeEach(() => {
    cy.login();
    cy.request("POST", "/api/groups", {
      name: `[cypress] Recurring ${Date.now()}`,
    }).then((res: Cypress.Response<{ data: { id: string } }>) => {
      groupId = res.body.data.id;
    });
  });

  // ---------------------------------------------------------------------------
  // UI: badge visibility
  // ---------------------------------------------------------------------------

  it("shows the recurring badge on a recurring expense card", () => {
    cy.then(() => cy.visit(`/groups/${groupId}`));

    cy.contains("Add expense").click();
    cy.get("#expenseDescription").type("[cypress] Monthly Groceries");
    cy.get("#expenseAmount").type("120.00");
    cy.get("#expenseDate").type("2026-02-01");

    // Check the "Repeat" checkbox to enable recurring
    cy.contains("Repeat").click();
    // Frequency select should appear defaulting to Monthly — target it specifically
    // by its unique options to avoid matching the "paid by" select (which has UUID values).
    cy.get("select").filter(':has(option[value="weekly"])').should("have.value", "monthly");

    cy.contains("Add expense", { matchCase: true })
      .filter("button[type='submit']")
      .click();

    cy.get(".modal-content").should("not.exist");
    cy.contains("[cypress] Monthly Groceries").should("be.visible");
    // The recurring SVG badge should be present
    cy.get('[aria-label="Recurring"]').should("exist");
  });

  it("does not show the recurring badge on a non-recurring expense", () => {
    cy.then(() => {
      cy.request("POST", `/api/groups/${groupId}/expenses`, {
        description: "[cypress] One-Off Expense",
        amountCents: 3000,
        date: "2026-02-01",
      });
      cy.visit(`/groups/${groupId}`);
    });

    cy.contains("[cypress] One-Off Expense").should("be.visible");
    cy.get('[aria-label="Recurring"]').should("not.exist");
  });

  // ---------------------------------------------------------------------------
  // Cron pipeline: generates next instance
  // ---------------------------------------------------------------------------

  it("cron generates next expense instance for a due recurring template", () => {
    const cronSecret = Cypress.env("CRON_SECRET") as string;

    // Create a recurring expense with a backdated start so nextDueDate is in
    // the past and the cron will process it immediately.
    cy.then(() => {
      cy.request("POST", `/api/groups/${groupId}/expenses`, {
        description: "[cypress] Monthly Dues",
        amountCents: 5000,
        date: BACKDATED_FIRST_DATE,
        recurring: { frequency: "monthly" },
      });
    });

    // Visit the page — 1 expense exists (the initial instance)
    cy.then(() => cy.visit(`/groups/${groupId}`));
    cy.contains("[cypress] Monthly Dues").should("be.visible");
    cy.get('[aria-label="Recurring"]').should("have.length", 1);

    // Trigger the cron endpoint directly
    cy.request({
      method: "POST",
      url: "/api/cron/process-recurring",
      headers: { authorization: `Bearer ${cronSecret}` },
    }).then((res: Cypress.Response<{ data: { processed: number }; error: null }>) => {
      expect(res.status).to.eq(200);
      // At least 1 expense was processed (our template)
      expect(res.body.data.processed).to.be.at.least(1);
    });

    // Reload — a second expense instance should now appear
    cy.reload();
    cy.get("li")
      .filter(':contains("[cypress] Monthly Dues")')
      .should("have.length.at.least", 2);

    // Both instances carry the recurring badge
    cy.get('[aria-label="Recurring"]').should("have.length.at.least", 2);
  });

  it("cron returns 401 with a wrong secret", () => {
    cy.request({
      method: "POST",
      url: "/api/cron/process-recurring",
      headers: { authorization: "Bearer wrong-secret" },
      failOnStatusCode: false,
    }).then((res: Cypress.Response<{ error: string }>) => {
      expect(res.status).to.eq(401);
      expect(res.body.error).to.eq("Unauthorized");
    });
  });

  // ---------------------------------------------------------------------------
  // Stop recurring: cron skips inactive templates
  // ---------------------------------------------------------------------------

  it("stopped recurring expense is not processed by cron", () => {
    const cronSecret = Cypress.env("CRON_SECRET") as string;

    // Create a backdated recurring expense then immediately stop it
    cy.then(() => {
      cy.request("POST", `/api/groups/${groupId}/expenses`, {
        description: "[cypress] Stopped Recurring",
        amountCents: 2000,
        date: BACKDATED_FIRST_DATE,
        recurring: { frequency: "monthly" },
      }).then((res: Cypress.Response<{ data: { recurringExpenseId: string } }>) => {
        const recurringId = res.body.data.recurringExpenseId;
        cy.request("DELETE", `/api/groups/${groupId}/recurring/${recurringId}`);
      });
    });

    // Trigger the cron — our stopped template should be skipped
    cy.request({
      method: "POST",
      url: "/api/cron/process-recurring",
      headers: { authorization: `Bearer ${cronSecret}` },
    }).then((res: Cypress.Response<{ data: { processed: number }; error: null }>) => {
      expect(res.status).to.eq(200);
      expect(res.body.data.processed).to.eq(0);
    });

    // Only the original instance exists — no cron-generated one
    cy.then(() => cy.visit(`/groups/${groupId}`));
    cy.get("li")
      .filter(':contains("[cypress] Stopped Recurring")')
      .should("have.length", 1);
  });

  // ---------------------------------------------------------------------------
  // Delete expense: also cleans up recurring template
  // ---------------------------------------------------------------------------

  it("deleting a recurring expense instance also stops the recurring template", () => {
    const cronSecret = Cypress.env("CRON_SECRET") as string;

    // Create a backdated recurring expense so cron could process it
    cy.then(() => {
      cy.request("POST", `/api/groups/${groupId}/expenses`, {
        description: "[cypress] Delete Stops Recurring",
        amountCents: 3500,
        date: BACKDATED_FIRST_DATE,
        recurring: { frequency: "monthly" },
      }).then((res: Cypress.Response<{ data: { id: string } }>) => {
        const expenseId = res.body.data.id;
        // Delete the expense instance — this should also delete the recurring template
        cy.request("DELETE", `/api/groups/${groupId}/expenses/${expenseId}`);
      });
    });

    // Trigger the cron — the recurring template should have been cleaned up
    cy.request({
      method: "POST",
      url: "/api/cron/process-recurring",
      headers: { authorization: `Bearer ${cronSecret}` },
    }).then((res: Cypress.Response<{ data: { processed: number }; error: null }>) => {
      expect(res.status).to.eq(200);
      // Template was deleted, so cron should not process anything
      expect(res.body.data.processed).to.eq(0);
    });

    // Verify no expenses exist in the group (the instance was deleted, and no cron-generated ones)
    cy.then(() => cy.visit(`/groups/${groupId}`));
    cy.contains("[cypress] Delete Stops Recurring").should("not.exist");
  });

  it("stop button removes recurring badge from future instances via UI", () => {
    // Create a recurring expense via API
    cy.then(() => {
      cy.request("POST", `/api/groups/${groupId}/expenses`, {
        description: "[cypress] Will Be Stopped",
        amountCents: 4000,
        date: "2026-02-01",
        recurring: { frequency: "monthly" },
      });
    });

    cy.then(() => cy.visit(`/groups/${groupId}`));
    cy.contains("[cypress] Will Be Stopped").should("be.visible");
    cy.get('[aria-label="Recurring"]').should("exist");

    // Open the expense detail modal and stop the recurring template
    cy.contains("[cypress] Will Be Stopped").closest("li").click();
    cy.get(".modal-content").should("be.visible");
    cy.contains("Stop recurring").click();

    // After stopping, the modal closes and the page refreshes automatically
    cy.get(".modal-content").should("not.exist");
    cy.contains("[cypress] Will Be Stopped").should("be.visible");
    cy.get('[aria-label="Recurring"]').should("not.exist");
  });
});
