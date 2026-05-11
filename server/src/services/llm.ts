import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { ParsedReceipt } from '../types';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a receipt parser. Extract structured data from receipt images and return ONLY valid JSON — no explanation, no markdown fences.`;

const USER_PROMPT = `Parse this receipt image and return a JSON object with this exact shape:

{
  "merchant": "store name or null",
  "merchantConfidence": 0.95,
  "date": "YYYY-MM-DD or null",
  "dateConfidence": 0.9,
  "lineItems": [
    { "name": "item description", "amount": 9.99, "type": "item", "confidence": 0.95 }
  ],
  "total": 29.97,
  "totalConfidence": 0.98,
  "currency": "USD",
  "overallConfidence": 0.92,
  "notes": "describe any issues: blur, partial visibility, unusual format, or leave empty string"
}

Rules:
- confidence values are floats 0.0–1.0; use 0.0 when you cannot determine a field
- type must be one of: "item" | "tax" | "tip" | "discount" | "subtotal" | "fee"
- Include ALL line entries on the receipt including tax, tip, subtotals, fees, discounts
- amounts are numbers (not strings); discounts and returns are negative
- date must be ISO YYYY-MM-DD format; use null if you cannot determine it
- overallConfidence reflects overall image quality and parsing reliability
- Return null (not a string) for fields you truly cannot read`;

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

async function callLlm(imagePath: string): Promise<ParsedReceipt> {
  const ext = path.extname(imagePath).toLowerCase();
  const mediaType: 'image/jpeg' | 'image/png' = ext === '.png' ? 'image/png' : 'image/jpeg';
  const base64 = fs.readFileSync(imagePath).toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected non-text response from LLM');

  const raw = stripJsonFences(block.text);
  const parsed = JSON.parse(raw) as ParsedReceipt;

  // Stamp IDs on line items so the frontend can key them
  parsed.lineItems = (parsed.lineItems ?? []).map((item, i) => ({
    ...item,
    id: `${Date.now()}-${i}`,
  }));

  return parsed;
}

export async function parseReceiptImage(imagePath: string): Promise<ParsedReceipt> {
  try {
    return await callLlm(imagePath);
  } catch (firstErr) {
    // One retry — LLM occasionally wraps output in prose on the first attempt
    try {
      return await callLlm(imagePath);
    } catch {
      // Fallback: return a blank receipt the user can fill in manually
      return {
        merchant: '',
        merchantConfidence: 0,
        date: null,
        dateConfidence: 0,
        lineItems: [],
        total: null,
        totalConfidence: 0,
        currency: 'USD',
        overallConfidence: 0,
        notes: 'Automatic parsing failed. Please fill in the fields manually.',
      };
    }
  }
}
