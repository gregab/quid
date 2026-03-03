import { vi, describe, it, expect, beforeEach } from "vitest";

// vi.hoisted runs before vi.mock hoisting, so mockCreate is available inside the factory
const { mockCreate } = vi.hoisted(() => {
  return { mockCreate: vi.fn() };
});

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

// Import after mocking
import { parseReceipt } from "./parseReceipt";

function makeTextResponse(text: string) {
  return {
    content: [{ type: "text", text }],
  };
}

describe("parseReceipt", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("parses a meal receipt with items and tax", async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse(
        JSON.stringify({
          receiptType: "meal",
          items: [
            { description: "Burger", amountCents: 1299, isTaxOrTip: false },
            { description: "Fries", amountCents: 399, isTaxOrTip: false },
            { description: "Tax", amountCents: 135, isTaxOrTip: true },
            { description: "Tip", amountCents: 260, isTaxOrTip: true },
          ],
        })
      )
    );

    const result = await parseReceipt("base64data", "image/jpeg");

    expect(result.receiptType).toBe("meal");
    expect(result.items).toHaveLength(4);
    expect(result.items[0]).toEqual({
      description: "Burger",
      amountCents: 1299,
      isTaxOrTip: false,
    });
    expect(result.items[2]).toEqual({
      description: "Tax",
      amountCents: 135,
      isTaxOrTip: true,
    });
  });

  it("parses a grocery receipt with receiptType 'other'", async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse(
        JSON.stringify({
          receiptType: "other",
          items: [
            { description: "Milk", amountCents: 349, isTaxOrTip: false },
            { description: "Bread", amountCents: 299, isTaxOrTip: false },
            { description: "Eggs", amountCents: 499, isTaxOrTip: false },
          ],
        })
      )
    );

    const result = await parseReceipt("base64data", "image/png");

    expect(result.receiptType).toBe("other");
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toEqual({
      description: "Milk",
      amountCents: 349,
      isTaxOrTip: false,
    });
  });

  it("handles JSON wrapped in markdown code block", async () => {
    const jsonPayload = JSON.stringify({
      receiptType: "meal",
      items: [{ description: "Pizza", amountCents: 1500, isTaxOrTip: false }],
    });

    mockCreate.mockResolvedValue(
      makeTextResponse(
        `Here is the parsed receipt:\n\`\`\`json\n${jsonPayload}\n\`\`\``
      )
    );

    const result = await parseReceipt("base64data", "image/webp");

    expect(result.receiptType).toBe("meal");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe("Pizza");
  });

  it("throws when Claude returns malformed JSON", async () => {
    mockCreate.mockResolvedValue(makeTextResponse("{ this is not valid json }"));

    await expect(parseReceipt("base64data", "image/jpeg")).rejects.toThrow();
  });

  it("throws a Zod error when Claude returns invalid schema (missing fields)", async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse(
        JSON.stringify({
          receiptType: "meal",
          items: [
            // Missing required fields: amountCents and isTaxOrTip
            { description: "Salad" },
          ],
        })
      )
    );

    await expect(parseReceipt("base64data", "image/jpeg")).rejects.toThrow();
  });

  it("throws when Claude returns no text content", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "tool_1", name: "some_tool", input: {} }],
    });

    await expect(parseReceipt("base64data", "image/jpeg")).rejects.toThrow(
      "No text response from Claude"
    );
  });
});
