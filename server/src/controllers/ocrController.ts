import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sql } from '../db/index.js';
import { getLangfuse } from '../services/langfuseService.js';
import { downloadFromR2 } from '../utils/r2Utils.js';
import { parseReceipt } from '../services/geminiService.js';

export const processOcr = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { sessionId } = req.body;
  const langfuse = getLangfuse();

  // Create Langfuse trace for this OCR request
  const trace = langfuse?.trace({
    id: id,
    name: 'receipt-ocr',
    userId: req.userId,
    sessionId: sessionId || undefined,
    metadata: { receiptId: id },
  });

  try {
    // DB fetch span: look up receipt and verify ownership
    const dbSpan = trace?.span({ name: 'db-fetch-receipt' });

    let receipts;
    if (req.organizationId) {
      receipts = await sql`
        SELECT id, image_url, user_id, organization_id, status
        FROM receipts
        WHERE id = ${id} AND organization_id = ${req.organizationId}
      `;
    } else {
      receipts = await sql`
        SELECT id, image_url, user_id, organization_id, status
        FROM receipts
        WHERE id = ${id} AND user_id = ${req.userId}
      `;
    }

    dbSpan?.end();

    if (receipts.length === 0) {
      trace?.update({ output: { error: 'Receipt not found' } });
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const receipt = receipts[0];

    if (!receipt.image_url) {
      trace?.update({ output: { error: 'No image URL on receipt' } });
      return res.status(400).json({ error: 'Receipt has no image URL' });
    }

    // R2 download span
    const downloadSpan = trace?.span({
      name: 'r2-download',
      metadata: { imageUrl: receipt.image_url },
    });

    const { buffer, contentType } = await downloadFromR2(receipt.image_url);

    downloadSpan?.end({
      metadata: { sizeBytes: buffer.length, contentType },
    });

    // Gemini OCR generation (Langfuse generation is created inside parseReceipt)
    const parsedData = await parseReceipt(buffer, contentType, {
      receiptId: id,
      traceId: id,
      userId: req.userId,
      sessionId: sessionId || undefined,
    });

    trace?.update({
      output: { parsedData },
    });

    res.json({ parsedData });
  } catch (error) {
    console.error('OCR endpoint error:', error);
    trace?.update({
      output: { error: error instanceof Error ? error.message : 'Unknown error' },
      metadata: { error: true },
    });
    res.status(500).json({
      error: 'Failed to process receipt OCR',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
