/**
 * Navigation and routing E2E tests.
 *
 * Covers the nav bar, dashboard ↔ group detail navigation,
 * and browser history (back/forward).
 *
 * Requires a running dev server: npm run dev
 * Requires cypress.env.json with SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD.
 */

describe("navigation", () => {
  beforeEach(() => {
    cy.login();
  });

  it("nav bar shows the 'Aviary' brand and the logged-in user's email", () => {
    cy.visit("/dashboard");
    cy.get("nav").contains("Aviary").should("be.visible");
    const email = Cypress.env("SMOKE_TEST_EMAIL") as string;
    cy.get("nav").contains(email).should("be.visible");
  });

  it("nav bar has a working Log out button", () => {
    cy.visit("/dashboard");
    cy.get("nav").contains("Log out").should("be.visible").click();
    cy.url().should("include", "/login");
  });

  it("navigates from dashboard to group detail and back via browser history", () => {
    // Create a group so there is at least one card
    const groupName = `[cypress] History ${Date.now()}`;
    cy.visit("/dashboard");
    cy.contains("+ New group").click();
    cy.get("#groupName").type(groupName);
    cy.contains("Create").click();
    cy.get(".modal-content").should("not.exist");

    // Click into the group detail page
    cy.contains(groupName).click();
    cy.url().should("match", /\/groups\/[0-9a-f-]{36}/);

    // Browser back → dashboard
    cy.go("back");
    cy.url().should("include", "/dashboard");
    cy.contains("Your groups").should("be.visible");

    // Browser forward → group detail
    cy.go("forward");
    cy.url().should("match", /\/groups\/[0-9a-f-]{36}/);
    cy.contains(groupName).should("be.visible");
  });

  it("404 paths outside basePath do not reach app routes", () => {
    // /api/groups without /aviary prefix should 404
    cy.request({
      method: "GET",
      url: "http://localhost:3000/api/groups",
      failOnStatusCode: false,
    }).its("status").should("eq", 404);
  });
});
