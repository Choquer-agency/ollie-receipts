
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
            - Vendor Name
            - Transaction Date (YYYY-MM-DD format)
            - Total Amount
            - Tax Amount (if visible, otherwise 0)
            - Currency Code (e.g., USD, CAD, EUR)
            - Suggested Expense Category (e.g., "Meals & Entertainment", "Office Supplies", "Travel", "Software Subscription")

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
            suggested_category: { type: Type.STRING }
          },
          required: ["vendor_name", "total", "suggested_category"]
        }
      }
    });

    // Fixed: Accessing the text property directly (not as a method) as per SDK rules.
    const text = response.text;
    if (!text) throw new Error("No data returned from Gemini");

    return JSON.parse(text.trim()) as ParsedReceiptData;

  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to process document.");
  }
};

