import { describe, it, expect } from "vitest";
import { formatDisplayName } from "./formatDisplayName";

describe("formatDisplayName", () => {
  it("abbreviates a two-word full name", () => {
    expect(formatDisplayName("Alex Miller")).toBe("Alex M.");
  });

  it("abbreviates a three-word name at the last word only", () => {
    expect(formatDisplayName("Mary Jane Watson")).toBe("Mary Jane W.");
  });

  it("leaves a single-word name untouched", () => {
    expect(formatDisplayName("Alex")).toBe("Alex");
  });

  it("leaves a lowercase single-word name untouched (user-typed handle)", () => {
    expect(formatDisplayName("alexm")).toBe("alexm");
  });

  it("does not abbreviate when the last word starts with lowercase", () => {
    // e.g. "van" in "Alex van Dijk" — but "Dijk" is the last word here
    expect(formatDisplayName("alex van dijk")).toBe("alex van dijk");
  });

  it("does not re-abbreviate a name that is already abbreviated", () => {
    expect(formatDisplayName("Alex M.")).toBe("Alex M.");
  });

  it("does not abbreviate a single-character last word", () => {
    expect(formatDisplayName("Alex B")).toBe("Alex B");
  });

  it("truncates a very long single-word name", () => {
    expect(formatDisplayName("Bartholomewwwwwwwwwww")).toBe("Bartholomewwwwwwwww…");
  });

  it("truncates after abbreviation if the result is still too long", () => {
    // "Bartholomewwwww Worthington" → "Bartholomewwwww W." = 18 chars → fine
    expect(formatDisplayName("Bartholomewwwww Worthington")).toBe("Bartholomewwwww W.");
  });

  it("handles empty string", () => {
    expect(formatDisplayName("")).toBe("");
  });

  it("handles whitespace-only string", () => {
    expect(formatDisplayName("   ")).toBe("");
  });
});
