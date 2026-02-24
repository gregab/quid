/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Log in using the UI login form and cache the session via cy.session().
       * The session is reused across tests in a spec, avoiding repeated UI logins.
       *
       * Requires SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD in cypress.env.json.
       */
      login(email?: string, password?: string): Chainable<void>;

      /**
       * Shorthand for cy.login() using the secondary test account
       * (SMOKE_TEST_EMAIL_2 / SMOKE_TEST_PASSWORD_2).
       * Used for multi-user flows such as the invite join tests.
       */
      login2(): Chainable<void>;
    }
  }
}

Cypress.Commands.add("login", (email?: string, password?: string) => {
  const e = email ?? (Cypress.env("SMOKE_TEST_EMAIL") as string);
  const p = password ?? (Cypress.env("SMOKE_TEST_PASSWORD") as string);

  if (!e || !p) {
    throw new Error(
      "Missing credentials for cy.login(). " +
        "Set SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD in cypress.env.json."
    );
  }

  cy.session(
    ["login", e],
    () => {
      cy.visit("/login");
      cy.get("#email").type(e);
      // {log: false} keeps the password out of Cypress logs
      cy.get("#password").type(p, { log: false });
      cy.contains("Sign in →").click();
      cy.url().should("include", "/dashboard");
    },
    {
      validate: () => {
        // If the session cookie has expired, this redirect will fail and
        // cy.session() will re-run the setup block above.
        cy.visit("/dashboard");
        cy.url().should("include", "/dashboard");
      },
    }
  );
});

Cypress.Commands.add("login2", () => {
  const e = Cypress.env("SMOKE_TEST_EMAIL_2") as string;
  const p = Cypress.env("SMOKE_TEST_PASSWORD_2") as string;

  if (!e || !p) {
    throw new Error(
      "Missing credentials for cy.login2(). " +
        "Set SMOKE_TEST_EMAIL_2 and SMOKE_TEST_PASSWORD_2 in cypress.env.json."
    );
  }

  cy.login(e, p);
});

export {};
