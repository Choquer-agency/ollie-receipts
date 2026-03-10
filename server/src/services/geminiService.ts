import Anthropic from '@anthropic-ai/sdk';
import { getLangfuse } from './langfuseService.js';
import { ParsedReceiptData } from '../types/receipt.js';

// Lazy-initialize to avoid crashing at module load when env var is missing
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

const MODEL = 'claude-haiku-4-5-20251001';

const PROMPT = `Analyze this receipt/document and extract the following fields. Return ONLY valid JSON with these exact keys:

{
  "vendor_name": "business name",
  "transaction_date": "YYYY-MM-DD",
  "total": 0.00,
  "tax": 0.00,
  "currency": "CAD",
  "suggested_category": "category",
  "description": "line items"
}

Rules:
- transaction_date: REQUIRED. Look for payment date, invoice date, or transaction date. Convert to YYYY-MM-DD. If multiple dates exist, prefer the payment/transaction date.
- total: the final amount paid
- tax: tax amount if visible, otherwise 0
- currency: e.g. USD, CAD, EUR — default to CAD if unclear
- suggested_category: e.g. "Meals & Entertainment", "Office Supplies", "Travel", "Software Subscription"
- description: list line items/products concisely separated by commas. If none found, leave empty string.

Return ONLY the JSON object, no markdown, no explanation.`;

export async function parseReceipt(
  imageBuffer: Buffer,
  mimeType: string,
  opts?: {
    receiptId?: string;
    traceId?: string;
    userId?: string;
    sessionId?: string;
  }
): Promise<ParsedReceiptData> {
  const langfuse = getLangfuse();
  const base64Data = imageBuffer.toString('base64');
  const imageSizeBytes = imageBuffer.length;

  const generation = langfuse?.generation({
    name: 'claude-ocr',
    model: MODEL,
    input: { prompt: PROMPT, imageMetadata: { mimeType, imageSizeBytes } },
    metadata: { mimeType, imageSizeBytes, receiptId: opts?.receiptId, userId: opts?.userId },
    traceId: opts?.traceId,
  });

  try {
    const isPdf = mimeType.includes('pdf');

    // Map mime type to Claude's supported media types
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    if (mimeType.includes('png')) mediaType = 'image/png';
    else if (mimeType.includes('gif')) mediaType = 'image/gif';
    else if (mimeType.includes('webp')) mediaType = 'image/webp';
    else mediaType = 'image/jpeg';

    const promptText = isPdf
      ? PROMPT.replace('receipt/document', 'document')
      : PROMPT;

    // Build content parts based on file type
    const contentParts: Anthropic.ContentBlockParam[] = isPdf
      ? [
          {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: base64Data,
            },
          },
          { type: 'text' as const, text: promptText },
        ]
      : [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: mediaType,
              data: base64Data,
            },
          },
          { type: 'text' as const, text: promptText },
        ];

    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: contentParts,
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find(b => b.type === 'text');
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : null;
    if (!text) throw new Error('No data returned from Claude');

    // Parse JSON — handle potential markdown code blocks
    const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(jsonStr) as ParsedReceiptData;

    // Apply fallback: if description is empty or just whitespace, use vendor name
    if (!parsed.description || parsed.description.trim() === '') {
      parsed.description = parsed.vendor_name;
    }

    // Update Langfuse generation with output and usage
    generation?.end({
      output: parsed,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
    });

    return parsed;
  } catch (error) {
    generation?.end({
      output: { error: error instanceof Error ? error.message : 'Unknown error' },
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : 'OCR failed',
    });
    const status = (error as any)?.status || (error as any)?.statusCode || '';
    const errorDetails = (error as any)?.error || (error as any)?.response?.data || '';
    console.error(`OCR Error [${status}] (mime: ${mimeType}, size: ${imageSizeBytes}b):`, error instanceof Error ? error.message : error, errorDetails ? JSON.stringify(errorDetails) : '');
    throw error;
  }
}
