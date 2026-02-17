import { GoogleGenAI, Type } from '@google/genai';
import { getLangfuse } from './langfuseService.js';
import { ParsedReceiptData } from '../types/receipt.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const MODEL = 'gemini-3-flash-preview';

const PROMPT = `Analyze this receipt/document and extract:
- Vendor Name (business name)
- Transaction Date (REQUIRED - look for payment date, invoice date, or transaction date. Convert to YYYY-MM-DD format. Common formats include MM/DD/YYYY, DD/MM/YYYY, Month DD YYYY. If multiple dates exist, prefer the payment/transaction date over issue dates.)
- Total Amount (the final amount paid)
- Tax Amount (if visible, otherwise 0)
- Currency Code (e.g., USD, CAD, EUR - default to CAD if unclear)
- Suggested Expense Category (e.g., "Meals & Entertainment", "Office Supplies", "Travel", "Software Subscription")
- Description (IMPORTANT - look for line items, products purchased, or itemized purchases. List them concisely, separated by commas. If no line items are visible, look for any notes, memo, or description fields on the receipt. If nothing is found, leave empty.)

IMPORTANT: Transaction date is mandatory. Search carefully for any date on the receipt.

Return the data in strict JSON format.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vendor_name: { type: Type.STRING },
    transaction_date: { type: Type.STRING },
    total: { type: Type.NUMBER },
    tax: { type: Type.NUMBER },
    currency: { type: Type.STRING },
    suggested_category: { type: Type.STRING },
    description: { type: Type.STRING },
  },
  required: ['vendor_name', 'transaction_date', 'total', 'suggested_category'],
};

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

  // Create Langfuse generation (or just call Gemini if Langfuse not configured)
  const generation = langfuse?.generation({
    name: 'gemini-ocr',
    model: MODEL,
    input: { prompt: PROMPT, imageMetadata: { mimeType, imageSizeBytes } },
    metadata: { mimeType, imageSizeBytes, receiptId: opts?.receiptId, userId: opts?.userId },
    traceId: opts?.traceId,
  });

  try {
    const isPdf = mimeType.includes('pdf');
    const promptText = isPdf
      ? PROMPT.replace('receipt/document', 'document')
      : PROMPT;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error('No data returned from Gemini');

    const parsed = JSON.parse(text.trim()) as ParsedReceiptData;

    // Apply fallback: if description is empty or just whitespace, use vendor name
    if (!parsed.description || parsed.description.trim() === '') {
      parsed.description = parsed.vendor_name;
    }

    // Update Langfuse generation with output and usage
    const usage = response.usageMetadata;
    generation?.end({
      output: parsed,
      usage: usage
        ? {
            input: usage.promptTokenCount,
            output: usage.candidatesTokenCount,
            total: usage.totalTokenCount,
          }
        : undefined,
    });

    return parsed;
  } catch (error) {
    generation?.end({
      output: { error: error instanceof Error ? error.message : 'Unknown error' },
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : 'OCR failed',
    });
    console.error('OCR Error:', error);
    throw new Error('Failed to process document.');
  }
}
