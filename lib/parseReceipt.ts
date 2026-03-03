import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const client = new Anthropic(); // uses ANTHROPIC_API_KEY env var

const receiptItemSchema = z.object({
  description: z.string(),
  amountCents: z.number().int(),
  isTaxOrTip: z.boolean(),
});

const receiptResponseSchema = z.object({
  receiptType: z.enum(["meal", "other"]),
  items: z.array(receiptItemSchema),
});

export type ParseReceiptResult = z.infer<typeof receiptResponseSchema>;

export async function parseReceipt(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
): Promise<ParseReceiptResult> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `Analyze this receipt image and extract all line items.

Return a JSON object with this exact structure:
{
  "receiptType": "meal" or "other",
  "items": [
    {
      "description": "Item name",
      "amountCents": 1250,
      "isTaxOrTip": false
    }
  ]
}

Rules:
- receiptType is "meal" for restaurant/food service receipts, "other" for grocery stores, retail, or any other receipt
- amountCents is the price in cents (integer, no decimals) - multiply dollar amount by 100
- isTaxOrTip is true for tax lines, tip lines, service charges, and similar fees
- Include all line items including subtotal adjustments, discounts (as negative amounts), etc.
- Do NOT include subtotal or total lines - only individual items
- If you cannot read a price clearly, make your best estimate
- Return ONLY the JSON object, no other text`,
          },
        ],
      },
    ],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Extract JSON from response (Claude might wrap in markdown code blocks)
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in Claude response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as unknown;
  return receiptResponseSchema.parse(parsed);
}
