/**
 * Invite flow E2E tests.
 *
 * Covers:
 *   - Unauthenticated users can view the invite page (no login redirect) —
 *     the page is intentionally public so OG crawlers and new users can see it
 *   - "Sign in to join" and "Sign up" links include ?next= back to the invite
 *   - Invalid-token error UI
 *   - Already-member server-side redirect (group creator)
 *   - Full join happy path: non-member visits invite link, clicks Join,
 *     lands on the group page (requires SMOKE_TEST_EMAIL_2)
 *   - Post-join: visiting the invite link again redirects to the group
 *
 * New-user sign-up path: unauthenticated user visits /invite/[token] →
 * clicks "Sign up" → goes to /signup?next=/invite/[token] → after email
 * confirmation the auth callback auto-joins the group and redirects to
 * /groups/[id]. The email-confirmation step can't be exercised here; it's
 * covered by unit tests in app/auth/callback/route.test.ts.
 *
 * Requires a running dev server: npm run dev
 * Requires cypress.env.json with SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD,
 * SMOKE_TEST_EMAIL_2, and SMOKE_TEST_PASSWORD_2.
 */

describe("invite flow", () => {
  describe("unauthenticated access", () => {
    let inviteToken: string;

    before(() => {
      // Create a real group to get a valid invite token, then clear the session
      // so all tests in this describe block run as an unauthenticated visitor.
      cy.login();
      cy.request<{ data: { id: string; inviteToken: string } }>({
        method: "POST",
        url: "/api/groups",
        body: { name: `[cypress] unauth-invite ${Date.now()}` },
      }).then((res) => {
        inviteToken = res.body.data.inviteToken;
      });
      cy.clearAllCookies();
    });

    it("unauthenticated user can view the invite page — no redirect to /login", () => {
      cy.then(() => cy.visit(`/invite/${inviteToken}`, { failOnStatusCode: false }));
      // Invite page is intentionally public; should stay on /invite/, not /login
      cy.url().should("include", "/invite/");
      cy.contains("Sign in to join").should("be.visible");
      cy.contains("Sign up").should("be.visible");
    });

    it("'Sign in to join' link points to /login with ?next= back to the invite", () => {
      cy.then(() => cy.visit(`/invite/${inviteToken}`, { failOnStatusCode: false }));
      cy.contains("Sign in to join")
        .should("have.attr", "href")
        .and("include", "/login")
        .and("include", "next=")
        .and("include", "invite");
    });

    it("'Sign up' link points to /signup with ?next= back to the invite", () => {
      cy.then(() => cy.visit(`/invite/${inviteToken}`, { failOnStatusCode: false }));
      cy.contains("Sign up")
        .should("have.attr", "href")
        .and("include", "/signup")
        .and("include", "next=")
        .and("include", "invite");
    });

    it("shows 'Invalid invite link' for a non-existent token", () => {
      cy.visit("/invite/this-token-does-not-exist-xyz", { failOnStatusCode: false });
      cy.contains("Invalid invite link").should("be.visible");
      cy.contains("This invite link is invalid or has been reset.").should("be.visible");
    });
  });

  describe("authenticated — invalid token", () => {
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
  });

  describe("authenticated — already a member (group creator)", () => {
    it("is redirected straight to the group page", () => {
      cy.login();
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

  describe("join happy path (requires SMOKE_TEST_EMAIL_2)", () => {
    let groupId: string;
    let inviteToken: string;
    const groupName = `[cypress] Invite Join ${Date.now()}`;

    before(() => {
      // User 1 (primary account) creates the group and retrieves the invite token.
      cy.login();
      cy.request<{ data: { id: string; inviteToken: string } }>({
        method: "POST",
        url: "/api/groups",
        body: { name: groupName },
      }).then((res) => {
        groupId = res.body.data.id;
        inviteToken = res.body.data.inviteToken;
      });
    });

    after(() => {
      // Best-effort cleanup: have user 2 leave the group so future test runs
      // start with user 2 as a non-member again.
      cy.login2();
      cy.then(() => {
        cy.request({
          method: "DELETE",
          url: `/api/groups/${groupId}/members`,
          failOnStatusCode: false,
        });
      });
    });

    it("non-member sees the group name, member count, and join button", () => {
      cy.login2();
      cy.then(() => cy.visit(`/invite/${inviteToken}`));

      cy.contains(groupName).should("be.visible");
      cy.contains("1 member").should("be.visible");
      cy.contains(`Join ${groupName}`).should("be.visible");
    });

    it("clicking Join redirects to the group page", () => {
      cy.login2();
      cy.then(() => cy.visit(`/invite/${inviteToken}`));

      cy.contains(`Join ${groupName}`).click();

      cy.url().should("include", `/groups/${groupId}`);
      cy.contains(groupName).should("be.visible");
    });

    it("visiting the invite link again after joining redirects straight to the group", () => {
      // User 2 is already a member from the previous test.
      cy.login2();
      cy.then(() => cy.visit(`/invite/${inviteToken}`));

      // isMember=true → server-side redirect, no join form shown
      cy.url().should("include", `/groups/${groupId}`);
      cy.contains(groupName).should("be.visible");
    });
  });
});
