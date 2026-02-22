/**
 * Invite flow E2E tests.
 *
 * Covers unauthenticated redirects (with ?next= preservation), invalid-token
 * error UI, and the already-member server-side redirect.
 *
 * Note: testing the full "non-member joins via invite" flow requires a second
 * user account. That path is covered by unit tests in InviteJoinForm.test.tsx.
 *
 * Note: new users who don't yet have an account are redirected to /login with
 * ?next= preserved. The login page respects ?next= and returns them to the
 * invite page after sign-in. However, the "Sign up" link on the login page
 * does NOT forward ?next=, so users who sign up fresh lose the invite context
 * and land on /dashboard. This is a known limitation — see TODOS.md.
 *
 * Requires a running dev server: npm run dev
 * Requires cypress.env.json with SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD.
 */

describe("invite flow", () => {
  describe("unauthenticated access", () => {
    it("redirects /invite/[token] to /login and preserves destination in ?next=", () => {
      cy.visit("/invite/fake-token", { failOnStatusCode: false });
      cy.url().should("include", "/login");
      cy.url().should("include", "next=");
      cy.url().should("include", "invite");
    });

    it("returns to the invite page after logging in via the ?next= redirect", () => {
      cy.visit("/invite/fake-token", { failOnStatusCode: false });
      cy.url().should("include", "/login");

      cy.get("#email").type(Cypress.env("SMOKE_TEST_EMAIL") as string);
      cy.get("#password").type(Cypress.env("SMOKE_TEST_PASSWORD") as string);
      cy.contains("Sign in →").click();

      // proxy sets ?next=/invite/fake-token; login page honours it
      cy.url().should("include", "/invite/fake-token");
      // token is fake → server renders the invalid-token error page
      cy.contains("Invalid invite link").should("be.visible");
    });
  });

  describe("authenticated", () => {
    beforeEach(() => {
      cy.login();
    });

    it("shows 'Invalid invite link' for a non-existent token", () => {
      cy.visit("/invite/this-token-does-not-exist-xyz");
      cy.contains("Invalid invite link").should("be.visible");
      cy.contains("This invite link is invalid or has been reset.").should("be.visible");
    });

    it("'← Go to dashboard' link navigates to /dashboard from the error page", () => {
      cy.visit("/invite/this-token-does-not-exist-xyz");
      cy.contains("Go to dashboard").click();
      cy.url().should("include", "/dashboard");
    });

    it("already-member visiting their group's invite page is redirected to the group", () => {
      cy.request<{ data: { id: string; inviteToken: string } }>({
        method: "POST",
        url: "/api/groups",
        body: { name: `[cypress] invite-already-member ${Date.now()}` },
      }).then((res) => {
        const { id, inviteToken } = res.body.data;

        cy.visit(`/invite/${inviteToken}`);

        // page.tsx calls get_group_by_invite_token RPC → isMember=true → redirect
        cy.url().should("include", `/groups/${id}`);
        cy.contains("[cypress]").should("be.visible");
      });
    });
  });
});
