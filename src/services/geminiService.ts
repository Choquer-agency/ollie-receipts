
import { GoogleGenAI, Type } from "@google/genai";
import { ParsedReceiptData } from "../types";

// Fixed: Initializing the GoogleGenAI client following the required syntax.
// Always use the API key directly from process.env.API_KEY without fallback.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const parseReceiptImage = async (base64Data: string, mimeType: string): Promise<ParsedReceiptData> => {
  // Remove data URL prefix if present
  const dataOnly = base64Data.replace(/^data:.*;base64,/, "");

  try {
    // Fixed: Using the recommended model 'gemini-3-flash-preview' for basic text and image tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: dataOnly
            }
          },
          {
            text: `Analyze this ${mimeType.includes('pdf') ? 'document' : 'receipt image'} and extract:
            - Vendor Name (business name)
            - Transaction Date (REQUIRED - look for payment date, invoice date, or transaction date. Convert to YYYY-MM-DD format. Common formats include MM/DD/YYYY, DD/MM/YYYY, Month DD YYYY. If multiple dates exist, prefer the payment/transaction date over issue dates.)
            - Total Amount (the final amount paid)
            - Tax Amount (if visible, otherwise 0)
            - Currency Code (e.g., USD, CAD, EUR - default to CAD if unclear)
            - Suggested Expense Category (e.g., "Meals & Entertainment", "Office Supplies", "Travel", "Software Subscription")
            - Description (IMPORTANT - look for line items, products purchased, or itemized purchases. List them concisely, separated by commas. If no line items are visible, look for any notes, memo, or description fields on the receipt. If nothing is found, leave empty.)

            IMPORTANT: Transaction date is mandatory. Search carefully for any date on the receipt.

            Return the data in strict JSON format.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vendor_name: { type: Type.STRING },
            transaction_date: { type: Type.STRING },
            total: { type: Type.NUMBER },
            tax: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            suggested_category: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["vendor_name", "transaction_date", "total", "suggested_category"]
        }
      }
    });

    // Fixed: Accessing the text property directly (not as a method) as per SDK rules.
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini");

    const parsed = JSON.parse(text.trim()) as ParsedReceiptData;
    
    // Apply fallback: if description is empty or just whitespace, use vendor name
    if (!parsed.description || parsed.description.trim() === '') {
      parsed.description = parsed.vendor_name;
    }
    
    // Debug logging to see what OCR extracted
    console.log('OCR Extraction Result:', parsed);
    console.log('Transaction Date extracted:', parsed.transaction_date);
    console.log('Description extracted:', parsed.description);

    return parsed;

  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to process document.");
  }
};

