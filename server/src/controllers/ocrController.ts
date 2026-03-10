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

  // Atomically claim receipts by setting status to 'processing'
  // This replaces the in-memory processingIds Set and survives server restarts
  let claimed;
  if (req.organizationId) {
    claimed = await sql`
      UPDATE receipts
      SET status = 'processing', updated_at = NOW()
      WHERE id = ANY(${receiptIds})
        AND organization_id = ${req.organizationId}
        AND status IN ('uploaded', 'error')
        AND COALESCE(ocr_retry_count, 0) < 10
      RETURNING id, image_url, original_filename
    `;
  } else {
    claimed = await sql`
      UPDATE receipts
      SET status = 'processing', updated_at = NOW()
      WHERE id = ANY(${receiptIds})
        AND user_id = ${req.userId}
        AND status IN ('uploaded', 'error')
        AND COALESCE(ocr_retry_count, 0) < 10
      RETURNING id, image_url, original_filename
    `;
  }

  const validReceipts = claimed.map((r: any) => ({
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

  if (validReceipts.length === 0) return;

  // Fire background processing (not awaited)
  processReceiptsInBackground(
    validReceipts,
    sessionId || crypto.randomUUID(),
    req.userId!,
    req.organizationId
  ).catch(err => console.error('Background batch OCR error:', err));
};

// Classify errors as permanent vs transient
function isPermanentError(error: any): boolean {
  const message = error?.message || '';
  const status = error?.status || error?.statusCode || 0;
  return (
    status === 401 ||
    status === 403 ||
    message.includes('API key') ||
    message.includes('authentication_error')
  );
}

function isRateLimitError(error: any): boolean {
  const status = error?.status || error?.statusCode || 0;
  const message = error?.message || '';
  return status === 429 || message.includes('rate_limit_error');
}

// Retry with exponential backoff — skip retries for permanent errors
// Rate limit errors get longer delays and more retries
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 2000): Promise<T> {
  const maxRetries = retries;
  let rateLimitRetries = 0;
  const MAX_RATE_LIMIT_RETRIES = 5;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (isPermanentError(error)) throw error;

      if (isRateLimitError(error)) {
        rateLimitRetries++;
        if (rateLimitRetries > MAX_RATE_LIMIT_RETRIES) throw error;
        // Wait 60s on rate limit (limit is per-minute), with jitter
        const delay = 60000 + Math.random() * 5000;
        console.log(`OCR rate limited (attempt ${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES}). Waiting ${Math.round(delay / 1000)}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (attempt >= maxRetries) throw error;
      const delay = baseDelay * Math.pow(2, attempt); // 2s, 4s, 8s
      console.log(`OCR attempt ${attempt + 1}/${maxRetries} failed: ${(error?.message || '').substring(0, 120)}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Process receipts sequentially to stay within rate limits (50K input tokens/min)
async function processReceiptsInBackground(
  receipts: Array<{ id: string; imageUrl: string; originalFilename: string }>,
  sessionId: string,
  userId: string,
  organizationId?: string
) {
  for (let i = 0; i < receipts.length; i++) {
    try {
      await processSingleReceiptOcr(receipts[i], sessionId, userId, organizationId);
    } catch (err) {
      console.error(`OCR failed for receipt ${receipts[i].id}:`, err);
    }
    // 2s gap between receipts to avoid bursting the rate limit
    if (i + 1 < receipts.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log(`Batch OCR complete: ${receipts.length} receipts processed`);
}

export async function processSingleReceiptOcr(
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
    // Download image from R2 (r2Utils already has its own retry)
    const downloadSpan = trace?.span({
      name: 'r2-download',
      metadata: { imageUrl: receipt.imageUrl },
    });

    const { buffer, contentType } = await downloadFromR2(receipt.imageUrl);

    downloadSpan?.end({
      metadata: { sizeBytes: buffer.length, contentType },
    });

    // Claude OCR with retry for rate limits / transient errors
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

    // Update receipt with OCR data — reset retry count on success
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
        ocr_retry_count = 0,
        ocr_last_error = NULL,
        qb_account_id = COALESCE(${autoQbAccountId}, qb_account_id),
        auto_categorized = ${autoRuleId ? true : false},
        auto_categorized_rule_id = ${autoRuleId},
        updated_at = NOW()
      WHERE id = ${receipt.id}
    `;

    trace?.update({ output: { parsedData, autoCategorized: !!autoRuleId } });
  } catch (error: any) {
    const errorMsg = error?.message || 'Unknown error';
    const errorDetail = error?.status || error?.statusCode || error?.response?.status || '';
    console.error(`OCR error for receipt ${receipt.id} [${errorDetail}]:`, errorMsg);

    // Permanent errors get retry_count=999 to prevent sweeper retries
    const retryCount = isPermanentError(error) ? 999 : undefined;

    // Mark receipt as error with retry tracking
    await sql`
      UPDATE receipts SET
        status = 'error',
        ocr_retry_count = CASE
          WHEN ${retryCount !== undefined ? retryCount : null}::int IS NOT NULL THEN ${retryCount || 0}
          ELSE COALESCE(ocr_retry_count, 0) + 1
        END,
        ocr_last_error = ${errorMsg.substring(0, 500)},
        updated_at = NOW()
      WHERE id = ${receipt.id}
    `.catch(err => console.error(`Failed to update error status for ${receipt.id}:`, err));

    trace?.update({
      output: { error: errorMsg },
      metadata: { error: true, permanent: isPermanentError(error) },
    });
  }
}
