import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sql } from '../db/index.js';
import { getLangfuse } from '../services/langfuseService.js';
import { downloadFromR2, deleteFromR2 } from '../utils/r2Utils.js';
import { parseReceipt } from '../services/geminiService.js';
import { checkForDuplicate } from './receiptController.js';
import { matchRule, incrementRuleApplied } from '../services/categoryRulesService.js';

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

// --- Batch OCR endpoint ---

export const processBatchOcr = async (req: AuthenticatedRequest, res: Response) => {
  const { receiptIds, sessionId } = req.body;

  if (!Array.isArray(receiptIds) || receiptIds.length === 0 || receiptIds.length > 500) {
    return res.status(400).json({ error: 'receiptIds must be an array of 1-500 IDs' });
  }

  // Verify all receipts belong to this user/org and are in 'uploaded' status
  let receipts;
  if (req.organizationId) {
    receipts = await sql`
      SELECT id, image_url, original_filename
      FROM receipts
      WHERE id = ANY(${receiptIds})
        AND organization_id = ${req.organizationId}
        AND status = 'uploaded'
    `;
  } else {
    receipts = await sql`
      SELECT id, image_url, original_filename
      FROM receipts
      WHERE id = ANY(${receiptIds})
        AND user_id = ${req.userId}
        AND status = 'uploaded'
    `;
  }

  const validReceipts = receipts.map((r: any) => ({
    id: r.id,
    imageUrl: r.image_url,
    originalFilename: r.original_filename,
  }));

  // Respond immediately
  res.status(202).json({
    accepted: validReceipts.length,
    total: receiptIds.length,
    message: 'OCR processing started',
  });

  // Fire background processing (not awaited)
  processReceiptsInBackground(
    validReceipts,
    sessionId || crypto.randomUUID(),
    req.userId!,
    req.organizationId
  ).catch(err => console.error('Background batch OCR error:', err));
};

// Retry wrapper - retries all transient errors (rate limits, network, 5xx)
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 2000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === retries) throw error;
      const status = error?.status || error?.statusCode || error?.response?.status;
      const message = error?.message || '';
      // Retry on: rate limits, server errors, network errors, resource exhausted
      const isRetryable = status === 429 || status >= 500
        || message.includes('429') || message.toLowerCase().includes('rate limit')
        || message.toLowerCase().includes('resource exhausted')
        || message.toLowerCase().includes('overloaded')
        || message.toLowerCase().includes('ECONNRESET')
        || message.toLowerCase().includes('timeout');
      if (!isRetryable) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Gemini error (${status || message.substring(0, 80)}), retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}

async function processReceiptsInBackground(
  receipts: Array<{ id: string; imageUrl: string; originalFilename: string }>,
  sessionId: string,
  userId: string,
  organizationId?: string
) {
  const CONCURRENCY = 3;
  const executing = new Set<Promise<void>>();

  for (const receipt of receipts) {
    const task = processSingleReceiptOcr(receipt, sessionId, userId, organizationId)
      .catch(err => console.error(`OCR failed for receipt ${receipt.id}:`, err))
      .finally(() => executing.delete(task));
    executing.add(task);
    if (executing.size >= CONCURRENCY) {
      await Promise.race(executing);
    }
    // Small stagger to avoid hitting Gemini rate limits
    await new Promise(r => setTimeout(r, 500));
  }
  await Promise.all(executing);
  console.log(`Batch OCR complete: ${receipts.length} receipts processed`);
}

async function processSingleReceiptOcr(
  receipt: { id: string; imageUrl: string; originalFilename: string },
  sessionId: string,
  userId: string,
  organizationId?: string
) {
  const langfuse = getLangfuse();
  const trace = langfuse?.trace({
    id: receipt.id,
    name: 'receipt-ocr',
    userId,
    sessionId,
    metadata: { receiptId: receipt.id, batch: true },
  });

  try {
    // Download image from R2
    const downloadSpan = trace?.span({
      name: 'r2-download',
      metadata: { imageUrl: receipt.imageUrl },
    });

    const { buffer, contentType } = await downloadFromR2(receipt.imageUrl);

    downloadSpan?.end({
      metadata: { sizeBytes: buffer.length, contentType },
    });

    // Gemini OCR with retry for rate limits
    const parsedData = await withRetry(() =>
      parseReceipt(buffer, contentType, {
        receiptId: receipt.id,
        traceId: receipt.id,
        userId,
        sessionId,
      })
    );

    // Check for transaction duplicates
    const dupResult = await checkForDuplicate(
      userId,
      undefined, // filename already checked upfront
      {
        vendorName: parsedData.vendor_name,
        transactionDate: parsedData.transaction_date,
        tax: parsedData.tax,
        total: parsedData.total,
      },
      organizationId
    );

    if (dupResult.isDuplicate && dupResult.reason === 'transaction_details' && dupResult.existingReceiptId !== receipt.id) {
      // Delete the duplicate receipt
      await deleteFromR2(receipt.imageUrl);
      await sql`DELETE FROM receipts WHERE id = ${receipt.id}`;
      console.log(`Receipt ${receipt.id} deleted as transaction duplicate of ${dupResult.existingReceiptId}`);
      trace?.update({ output: { duplicate: true, existingReceiptId: dupResult.existingReceiptId } });
      return;
    }

    // Auto-categorize if possible
    let autoQbAccountId: string | null = null;
    let autoRuleId: string | null = null;
    if (parsedData.vendor_name) {
      try {
        const rule = await matchRule(userId, parsedData.vendor_name);
        if (rule && rule.qb_account_id) {
          autoQbAccountId = rule.qb_account_id;
          autoRuleId = rule.id;
          await incrementRuleApplied(rule.id);
        }
      } catch (err) {
        // Non-critical, continue without auto-categorization
      }
    }

    // Update receipt with OCR data
    await sql`
      UPDATE receipts SET
        vendor_name = ${parsedData.vendor_name},
        transaction_date = ${parsedData.transaction_date},
        total = ${parsedData.total},
        tax = ${parsedData.tax || 0},
        currency = ${parsedData.currency || 'CAD'},
        suggested_category = ${parsedData.suggested_category},
        description = ${parsedData.description || parsedData.vendor_name},
        status = 'ocr_complete',
        qb_account_id = COALESCE(${autoQbAccountId}, qb_account_id),
        auto_categorized = ${autoRuleId ? true : false},
        auto_categorized_rule_id = ${autoRuleId},
        updated_at = NOW()
      WHERE id = ${receipt.id}
    `;

    trace?.update({ output: { parsedData, autoCategorized: !!autoRuleId } });
  } catch (error: any) {
    const errorDetail = error?.status || error?.statusCode || error?.response?.status || '';
    console.error(`OCR error for receipt ${receipt.id} [${errorDetail}]:`, error?.message || error);

    // Mark receipt as error
    await sql`
      UPDATE receipts SET status = 'error', updated_at = NOW()
      WHERE id = ${receipt.id}
    `.catch(err => console.error(`Failed to update error status for ${receipt.id}:`, err));

    trace?.update({
      output: { error: error instanceof Error ? error.message : 'Unknown error' },
      metadata: { error: true },
    });
  }
}
