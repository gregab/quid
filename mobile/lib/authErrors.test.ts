import { describe, it, expect } from "vitest";
import { friendlyAuthError } from "./authErrors";

describe("friendlyAuthError", () => {
  it("maps 'Invalid login credentials' to friendly message", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe(
      "Incorrect email or password. Please try again.",
    );
  });

  it("maps 'Email not confirmed' to friendly message", () => {
    expect(friendlyAuthError("Email not confirmed")).toBe(
      "Please check your email and confirm your account before logging in.",
    );
  });

  it("maps 'User already registered' to friendly message", () => {
    expect(friendlyAuthError("User already registered")).toBe(
      "An account with this email already exists. Try logging in instead.",
    );
  });

  it("maps rate limit messages via partial match", () => {
    expect(
      friendlyAuthError(
        "For security purposes, you can only request this after 60 seconds",
      ),
    ).toBe("Too many attempts. Please wait a moment and try again.");
  });

  it("returns generic error for unknown messages", () => {
    expect(friendlyAuthError("Some internal DB error xyz")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
