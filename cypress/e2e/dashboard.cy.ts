/**
 * Dashboard E2E tests.
 *
 * Covers the group list, create-group modal, and basePath correctness
 * for group card links.
 *
 * Requires a running dev server: npm run dev
 * Requires cypress.env.json with SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD.
 */

describe("dashboard", () => {
  beforeEach(() => {
    cy.login();
    cy.visit("/dashboard");
  });

  it("loads the dashboard with 'Your groups' heading", () => {
    cy.contains("Your groups").should("be.visible");
  });

  it("shows the user's email in the nav", () => {
    const email = Cypress.env("SMOKE_TEST_EMAIL") as string;
    cy.contains(email).should("be.visible");
  });

  it("opens the create group modal when clicking '+ New group'", () => {
    cy.contains("+ New group").click();
    cy.get(".modal-content").should("be.visible");
    cy.get("#groupName").should("be.visible").and("be.focused");
  });

  it("closes the create group modal on Cancel", () => {
    cy.contains("+ New group").click();
    cy.get(".modal-content").should("be.visible");
    cy.contains("Cancel").click();
    cy.get(".modal-content").should("not.exist");
  });

  it("creates a new group and shows it in the list", () => {
    const groupName = `[cypress] Group ${Date.now()}`;
    cy.contains("+ New group").click();
    cy.get("#groupName").type(groupName);
    cy.contains("Create").click();
    // Modal closes
    cy.get(".modal-content").should("not.exist");
    // Group card appears in the list
    cy.contains(groupName).should("be.visible");
  });

  it("group card links include the /aviary basePath prefix", () => {
    // Create a group so there is definitely at least one card
    const groupName = `[cypress] BasePath ${Date.now()}`;
    cy.contains("+ New group").click();
    cy.get("#groupName").type(groupName);
    cy.contains("Create").click();
    cy.get(".modal-content").should("not.exist");

    // The Link's rendered href must start with /aviary/groups/
    cy.contains(groupName)
      .closest("a")
      .should("have.attr", "href")
      .and("match", /^\/aviary\/groups\//);
  });

  it("clicking a group card navigates to the group detail page", () => {
    const groupName = `[cypress] Nav ${Date.now()}`;
    cy.contains("+ New group").click();
    cy.get("#groupName").type(groupName);
    cy.contains("Create").click();
    cy.get(".modal-content").should("not.exist");

    cy.contains(groupName).click();
    cy.url().should("match", /\/groups\/[0-9a-f-]{36}/);
    // Group name appears on the detail page
    cy.contains(groupName).should("be.visible");
  });

  it("does not submit the create group form with an empty name", () => {
    cy.contains("+ New group").click();
    // Input has `required` — HTML5 validation prevents submission
    cy.contains("Create").click();
    // Modal must still be open
    cy.get(".modal-content").should("be.visible");
  });
});
