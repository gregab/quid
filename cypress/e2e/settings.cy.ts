/**
 * Settings page E2E tests.
 *
 * Covers the settings page layout, account info display,
 * and the delete account confirmation flow (without actually deleting).
 *
 * Requires a running dev server: npm run dev
 * Requires cypress.env.json with SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD.
 */

describe("settings page", () => {
  beforeEach(() => {
    cy.login();
  });

  it("is reachable via the nav gear icon", () => {
    cy.visit("/dashboard");
    cy.get('a[aria-label="Settings"]').click();
    cy.url().should("include", "/settings");
    cy.contains("Settings").should("be.visible");
  });

  it("displays the user email", () => {
    cy.visit("/settings");
    const email = Cypress.env("SMOKE_TEST_EMAIL") as string;
    cy.contains(email).should("be.visible");
  });

  it("shows the danger zone with delete account button", () => {
    cy.visit("/settings");
    cy.contains("Danger zone").should("be.visible");
    cy.contains("button", "Delete account").should("be.visible");
  });

  it("opens confirmation modal and requires typing DELETE", () => {
    cy.visit("/settings");
    cy.contains("button", "Delete account").click();

    // Modal should be visible
    cy.contains("Delete your account?").should("be.visible");

    // Confirm button should be disabled initially
    cy.contains("button", "Delete my account").should("be.disabled");

    // Type wrong text — still disabled
    cy.get("#confirmDelete").type("delete");
    cy.contains("button", "Delete my account").should("be.disabled");

    // Clear and type correct text — enabled
    cy.get("#confirmDelete").clear().type("DELETE");
    cy.contains("button", "Delete my account").should("not.be.disabled");

    // Cancel closes modal (don't actually delete!)
    cy.contains("button", "Cancel").click();
    cy.contains("Delete your account?").should("not.exist");
  });
});
