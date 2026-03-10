import cron from 'node-cron';
import { sql } from '../db/index.js';
import { processSingleReceiptOcr } from '../controllers/ocrController.js';

const SWEEPER_CONCURRENCY = 1;
const MAX_STUCK_MINUTES = 5;
const MAX_RETRY_COUNT = 10;
const MAX_RECEIPTS_PER_RUN = 10;

let sweeping = false;

async function sweep() {
  if (sweeping) return;
  sweeping = true;

  try {
    // Find receipts that need retry:
    // 1. status = 'error' with retry_count < 10
    // 2. status = 'processing' stuck for > 5 minutes (server crash recovery)
    const candidates = await sql`
      SELECT id, image_url, original_filename, user_id, organization_id
      FROM receipts
      WHERE (
        (status = 'error' AND COALESCE(ocr_retry_count, 0) < ${MAX_RETRY_COUNT})
        OR
        (status = 'processing' AND updated_at < NOW() - INTERVAL '5 minutes')
      )
      ORDER BY updated_at ASC
      LIMIT ${MAX_RECEIPTS_PER_RUN}
    `;

    if (candidates.length === 0) return;

    console.log(`OCR sweeper: found ${candidates.length} receipts to retry`);

    // Atomically claim them by setting status to 'processing'
    const ids = candidates.map((r: any) => r.id);
    const claimed = await sql`
      UPDATE receipts
      SET status = 'processing', updated_at = NOW()
      WHERE id = ANY(${ids})
        AND (status IN ('error', 'processing'))
        AND COALESCE(ocr_retry_count, 0) < ${MAX_RETRY_COUNT}
      RETURNING id, image_url, original_filename, user_id, organization_id
    `;

    if (claimed.length === 0) return;

    // Process in batches of SWEEPER_CONCURRENCY
    for (let i = 0; i < claimed.length; i += SWEEPER_CONCURRENCY) {
      const batch = claimed.slice(i, i + SWEEPER_CONCURRENCY);
      await Promise.allSettled(
        batch.map((r: any) =>
          processSingleReceiptOcr(
            { id: r.id, imageUrl: r.image_url, originalFilename: r.original_filename },
            `sweeper-${Date.now()}`,
            r.user_id,
            r.organization_id || undefined
          )
        )
      );
      if (i + SWEEPER_CONCURRENCY < claimed.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log(`OCR sweeper: finished retrying ${claimed.length} receipts`);
  } catch (err) {
    console.error('OCR sweeper error:', err);
  } finally {
    sweeping = false;
  }
}

export function startOcrSweeperJob() {
  // Run every 2 minutes
  cron.schedule('*/2 * * * *', () => {
    sweep().catch(err => console.error('OCR sweeper unhandled error:', err));
  });

  console.log('OCR sweeper job scheduled (every 2 minutes)');
}
