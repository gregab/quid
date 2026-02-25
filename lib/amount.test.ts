import { describe, it, expect } from "vitest";
import {
  filterAmountInput,
  filterDecimalInput,
  stripAmountFormatting,
  formatAmountDisplay,
  MAX_AMOUNT_DOLLARS,
} from "./amount";

describe("filterAmountInput", () => {
  it("allows digits, one dot, and commas", () => {
    expect(filterAmountInput("1,234.56")).toBe("1,234.56");
  });

  it("strips non-numeric characters", () => {
    expect(filterAmountInput("abc$12.34")).toBe("12.34");
  });

  it("limits to 2 decimal places", () => {
    expect(filterAmountInput("12.345")).toBe("12.34");
  });

  it("allows only one dot", () => {
    expect(filterAmountInput("12.34.56")).toBe("12.34");
  });

  it("caps integer digits at MAX_AMOUNT_DOLLARS length (6 digits)", () => {
    // 100000 is 6 digits — that's the max
    expect(filterAmountInput("100000")).toBe("100000");
    // 7 digits should be truncated to 6
    expect(filterAmountInput("1234567")).toBe("123456");
  });

  it("caps integer digits even with commas present", () => {
    // commas pass through but only 6 integer digits are kept
    expect(filterAmountInput("1,234,567")).toBe("1,234,56");
  });

  it("allows full 6 integer digits plus decimals", () => {
    expect(filterAmountInput("100000.99")).toBe("100000.99");
  });

  it("does not cap decimal digits as integer digits", () => {
    expect(filterAmountInput("999999.99")).toBe("999999.99");
  });

  it("returns empty for empty input", () => {
    expect(filterAmountInput("")).toBe("");
  });

  it("handles leading dot", () => {
    expect(filterAmountInput(".99")).toBe(".99");
  });
});

describe("filterDecimalInput", () => {
  it("allows digits and one dot, no commas", () => {
    expect(filterDecimalInput("1234.56")).toBe("1234.56");
  });

  it("strips commas", () => {
    expect(filterDecimalInput("1,234.56")).toBe("1234.56");
  });

  it("limits to 2 decimal places", () => {
    expect(filterDecimalInput("12.345")).toBe("12.34");
  });

  it("caps integer digits at 6", () => {
    expect(filterDecimalInput("1234567.89")).toBe("123456.89");
  });

  it("returns empty for empty input", () => {
    expect(filterDecimalInput("")).toBe("");
  });
});

describe("stripAmountFormatting", () => {
  it("removes commas", () => {
    expect(stripAmountFormatting("1,234.56")).toBe("1234.56");
  });
});

describe("formatAmountDisplay", () => {
  it("formats with commas and 2 decimals", () => {
    expect(formatAmountDisplay("1234.5")).toBe("1,234.50");
  });

  it("returns empty for empty", () => {
    expect(formatAmountDisplay("")).toBe("");
  });

  it("returns dot for just dot", () => {
    expect(formatAmountDisplay(".")).toBe(".");
  });
});

describe("MAX_AMOUNT_DOLLARS", () => {
  it("is 100000", () => {
    expect(MAX_AMOUNT_DOLLARS).toBe(100_000);
  });
});
