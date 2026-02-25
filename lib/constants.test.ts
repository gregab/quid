import { describe, expect, it } from "vitest";
import {
  MAX_GROUP_NAME,
  MAX_EXPENSE_DESCRIPTION,
  MAX_DISPLAY_NAME,
  MAX_EMAIL,
  MAX_FEEDBACK_MESSAGE,
} from "./constants";

describe("character-length constants", () => {
  it("exports positive integers for all limits", () => {
    for (const val of [MAX_GROUP_NAME, MAX_EXPENSE_DESCRIPTION, MAX_DISPLAY_NAME, MAX_EMAIL, MAX_FEEDBACK_MESSAGE]) {
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThan(0);
    }
  });

  it("has expected values", () => {
    expect(MAX_GROUP_NAME).toBe(100);
    expect(MAX_EXPENSE_DESCRIPTION).toBe(200);
    expect(MAX_DISPLAY_NAME).toBe(30);
    expect(MAX_EMAIL).toBe(254);
    expect(MAX_FEEDBACK_MESSAGE).toBe(5000);
  });
});
