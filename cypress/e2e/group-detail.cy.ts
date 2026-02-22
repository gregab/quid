/**
 * Group detail page E2E tests.
 *
 * Each test creates a fresh group via the API, then exercises the full
 * add/edit/delete expense flow through the UI.
 *
 * Requires a running dev server: npm run dev
 * Requires cypress.env.json with SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD.
 */

describe("group detail", () => {
  let groupId: string;

  beforeEach(() => {
    cy.login();
    // Create a fresh group for each test so they're fully isolated
    cy.request("POST", "/api/groups", {
      name: `[cypress] Group ${Date.now()}`,
    }).then((res: Cypress.Response<{ data: { id: string } }>) => {
      groupId = res.body.data.id;
    });
  });

  it("loads the group page with the key sections", () => {
    cy.then(() => cy.visit(`/groups/${groupId}`));
    cy.contains("Expenses").should("be.visible");
    cy.contains("Add expense").should("be.visible");
    cy.contains("Members").should("be.visible");
    cy.contains("Recent activity").should("be.visible");
  });

  it("opens the add expense modal", () => {
    cy.then(() => cy.visit(`/groups/${groupId}`));
    cy.contains("Add expense").click();
    cy.get(".modal-content").should("be.visible");
    cy.get("#expenseDescription").should("be.visible").and("be.focused");
    cy.get("#expenseAmount").should("be.visible");
    cy.get("#expenseDate").should("be.visible");
  });

  it("closes the add expense modal on Cancel", () => {
    cy.then(() => cy.visit(`/groups/${groupId}`));
    cy.contains("Add expense").click();
    cy.get(".modal-content").should("be.visible");
    cy.contains("Cancel").click();
    cy.get(".modal-content").should("not.exist");
  });

  it("adds an expense and shows it in the list and activity feed", () => {
    cy.then(() => cy.visit(`/groups/${groupId}`));
    const description = `[cypress] Dinner ${Date.now()}`;

    cy.contains("Add expense").click();
    cy.get("#expenseDescription").type(description);
    cy.get("#expenseAmount").type("30.00");
    cy.get("#expenseDate").type("2026-01-15");
    cy.contains("Add expense", { matchCase: true })
      .filter("button[type='submit']")
      .click();

    // Modal closes immediately (optimistic)
    cy.get(".modal-content").should("not.exist");
    // Expense card appears
    cy.contains(description).should("be.visible");
    cy.contains("$30.00").should("be.visible");
    // Activity feed shows the add event
    cy.contains("added").should("be.visible");
  });

  it("edits an expense and reflects the change in the list", () => {
    const original = `[cypress] Original ${Date.now()}`;
    const edited = `[cypress] Edited ${Date.now()}`;

    cy.then(() => {
      // Add expense via API for speed, then visit the page
      cy.request("POST", `/api/groups/${groupId}/expenses`, {
        description: original,
        amountCents: 2000,
        date: "2026-01-15",
      });
      cy.visit(`/groups/${groupId}`);
    });

    // Click the edit (pencil) button for this expense
    cy.contains(original)
      .closest("li")
      .find('[aria-label="Edit expense"]')
      .click();

    cy.get(".modal-content").should("be.visible");
    cy.get("#editDescription").clear().type(edited);
    cy.get("#editAmount").clear().type("45.00");
    cy.contains("Save changes").click();

    // Modal closes and expense card updates
    cy.get(".modal-content").should("not.exist");
    cy.contains(edited).should("be.visible");
    cy.contains("$45.00").should("be.visible");
    // Activity feed reflects the edit
    cy.contains("edited").should("be.visible");
  });

  it("deletes an expense and removes it from the list", () => {
    const description = `[cypress] To Delete ${Date.now()}`;

    cy.then(() => {
      cy.request("POST", `/api/groups/${groupId}/expenses`, {
        description,
        amountCents: 1500,
        date: "2026-01-15",
      });
      cy.visit(`/groups/${groupId}`);
    });

    // Click the trash button for this expense
    cy.contains(description)
      .closest("li")
      .find('[aria-label="Delete expense"]')
      .click();

    // Delete confirmation dialog appears
    cy.contains("Delete expense?").should("be.visible");
    cy.contains(description).should("be.visible");

    // Confirm deletion
    cy.get(".modal-content").contains("Delete").click();

    // Expense disappears from the list
    cy.contains(description).should("not.exist");
    // Activity feed shows the delete event
    cy.contains("deleted").should("be.visible");
  });

  it("shows 'No expenses yet' when the group has no expenses", () => {
    cy.then(() => cy.visit(`/groups/${groupId}`));
    cy.contains("No expenses yet").should("be.visible");
  });

  it("shows the balances section", () => {
    cy.then(() => cy.visit(`/groups/${groupId}`));
    // The balances section header or the settled-up message should be visible
    cy.contains(/balances|settled/i).should("be.visible");
  });
});
