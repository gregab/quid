/**
 * Auth flow E2E tests.
 *
 * Covers unauthenticated redirect behaviour, UI login/logout, and the
 * "already logged in" redirect from /login → /dashboard.
 *
 * Requires a running dev server: npm run dev
 * Requires cypress.env.json with SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD.
 */

describe("authentication", () => {
  describe("unauthenticated users", () => {
    it("shows the login form at /login", () => {
      cy.visit("/login");
      cy.get("#email").should("be.visible");
      cy.get("#password").should("be.visible");
      cy.contains("Sign in →").should("be.visible");
      cy.contains("No account?").should("be.visible");
    });

    it("redirects /dashboard to /login", () => {
      cy.visit("/dashboard", { failOnStatusCode: false });
      cy.url().should("include", "/login");
    });

    it("redirects /groups/* to /login", () => {
      cy.visit("/groups/00000000-0000-0000-0000-000000000001", {
        failOnStatusCode: false,
      });
      cy.url().should("include", "/login");
    });

    it("shows an error message for invalid credentials", () => {
      cy.visit("/login");
      cy.get("#email").type("nonexistent@example.com");
      cy.get("#password").type("wrongpassword123");
      cy.contains("Sign in →").click();
      // Should stay on /login and surface an error
      cy.url().should("include", "/login");
      // The login page renders errors in a red pill
      cy.get(".text-red-600").should("be.visible");
    });

    it("can navigate from /login to /signup", () => {
      cy.visit("/login");
      cy.contains("Sign up").click();
      cy.url().should("include", "/signup");
    });
  });

  describe("authenticated users", () => {
    beforeEach(() => {
      cy.login();
    });

    it("redirects /login to /dashboard when already authenticated", () => {
      cy.visit("/login");
      cy.url().should("include", "/dashboard");
    });

    it("logs out via the nav button and lands on /login", () => {
      cy.visit("/dashboard");
      cy.contains("Log out").click();
      cy.url().should("include", "/login");
    });

    it("/dashboard is inaccessible after logout", () => {
      cy.visit("/dashboard");
      cy.contains("Log out").click();
      cy.url().should("include", "/login");
      // Visiting /dashboard without a session should redirect back to /login
      cy.visit("/dashboard", { failOnStatusCode: false });
      cy.url().should("include", "/login");
    });
  });
});
