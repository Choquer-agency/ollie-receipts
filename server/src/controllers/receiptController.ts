import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sql } from '../db/index.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from '../config/r2.js';
import { z } from 'zod';
import { logAuditEvent } from '../services/auditService.js';
import { matchRule, incrementRuleApplied } from '../services/categoryRulesService.js';


// Rewrite old R2 public URLs to the current custom domain
const OLD_R2_URL_PREFIX = 'https://pub-';
function rewriteImageUrl(url: string | null): string | null {
  if (!url || !R2_PUBLIC_URL) return url;
  // Already using the current domain
  if (url.startsWith(R2_PUBLIC_URL)) return url;
  // Old R2 dev URLs: extract the key (everything after the host/path prefix)
  const receiptsIdx = url.indexOf('/receipts/');
  if (receiptsIdx !== -1) {
    return `${R2_PUBLIC_URL}${url.substring(receiptsIdx)}`;
  }
  return url;
}

function rewriteReceiptUrls<T extends { image_url?: string | null }>(rows: T[]): T[] {
  return rows.map(row => ({
    ...row,
    image_url: rewriteImageUrl(row.image_url ?? null),
  }));
}

// Validation schemas
const createReceiptSchema = z.object({
  imageUrl: z.string().url(),
  status: z.string(),
  originalFilename: z.string().optional(),
  vendorName: z.string().optional(),
  transactionDate: z.string().optional(),
  subtotal: z.number().optional(),
  tax: z.number().optional(),
  total: z.number().optional(),
  currency: z.string().optional(),
  suggestedCategory: z.string().optional(),
  description: z.string().optional(),
  documentType: z.string().optional(),
  taxTreatment: z.string().optional(),
  taxRate: z.number().optional(),
  publishTarget: z.string().optional(),
  isPaid: z.boolean().optional(),
  paymentAccountId: z.string().optional(),
  qbAccountId: z.string().optional(),
  paidBy: z.string().optional(),
});

const updateReceiptSchema = createReceiptSchema.partial();

// Helper function to check for duplicates
interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: 'filename' | 'transaction_details';
  existingReceiptId?: string;
}

const checkForDuplicate = async (
  userId: string,
  filename?: string,
  transactionDetails?: {
    vendorName?: string;
    transactionDate?: string;
    subtotal?: number;
    tax?: number;
    total?: number;
  },
  organizationId?: string
): Promise<DuplicateCheckResult> => {
  // Check 1: Filename match (scoped to org or user)
  if (filename) {
    let filenameMatches;
    if (organizationId) {
      filenameMatches = await sql`
        SELECT id FROM receipts
        WHERE organization_id = ${organizationId}
        AND original_filename = ${filename}
        LIMIT 1
      `;
    } else {
      filenameMatches = await sql`
        SELECT id FROM receipts
        WHERE user_id = ${userId}
        AND original_filename = ${filename}
        LIMIT 1
      `;
    }

    if (filenameMatches.length > 0) {
      return {
        isDuplicate: true,
        reason: 'filename',
        existingReceiptId: filenameMatches[0].id,
      };
    }
  }

  // Check 2: Transaction details match (all fields must match)
  if (transactionDetails?.vendorName &&
      transactionDetails?.transactionDate &&
      transactionDetails?.total !== undefined) {
    let detailsMatches;
    if (organizationId) {
      detailsMatches = await sql`
        SELECT id FROM receipts
        WHERE organization_id = ${organizationId}
        AND vendor_name = ${transactionDetails.vendorName}
        AND transaction_date = ${transactionDetails.transactionDate}
        AND total = ${transactionDetails.total}
        AND COALESCE(tax, 0) = ${transactionDetails.tax || 0}
        AND COALESCE(subtotal, 0) = ${transactionDetails.subtotal || 0}
        LIMIT 1
      `;
    } else {
      detailsMatches = await sql`
        SELECT id FROM receipts
        WHERE user_id = ${userId}
        AND vendor_name = ${transactionDetails.vendorName}
        AND transaction_date = ${transactionDetails.transactionDate}
        AND total = ${transactionDetails.total}
        AND COALESCE(tax, 0) = ${transactionDetails.tax || 0}
        AND COALESCE(subtotal, 0) = ${transactionDetails.subtotal || 0}
        LIMIT 1
      `;
    }

    if (detailsMatches.length > 0) {
      return {
        isDuplicate: true,
        reason: 'transaction_details',
        existingReceiptId: detailsMatches[0].id,
      };
    }
  }

  return { isDuplicate: false };
};

export const getReceipts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query;

    console.log('getReceipts called for user:', req.userId, 'org:', req.organizationId);

    let receipts;

    if (req.organizationId) {
      // Org mode
      const isEmployee = req.orgRole === 'org:employee';

      if (isEmployee) {
        // Employees only see their own uploads
        if (status) {
          receipts = await sql`
            SELECT r.*, u.name as uploaded_by_name
            FROM receipts r
            LEFT JOIN users u ON r.uploaded_by = u.id
            WHERE r.organization_id = ${req.organizationId}
              AND r.uploaded_by = ${req.userId}
              AND r.status = ${status as string}
            ORDER BY r.created_at DESC
          `;
        } else {
          receipts = await sql`
            SELECT r.*, u.name as uploaded_by_name
            FROM receipts r
            LEFT JOIN users u ON r.uploaded_by = u.id
            WHERE r.organization_id = ${req.organizationId}
              AND r.uploaded_by = ${req.userId}
            ORDER BY r.created_at DESC
          `;
        }
      } else {
        // Admin/Bookkeeper see all org receipts
        if (status) {
          receipts = await sql`
            SELECT r.*, u.name as uploaded_by_name
            FROM receipts r
            LEFT JOIN users u ON r.uploaded_by = u.id
            WHERE r.organization_id = ${req.organizationId}
              AND r.status = ${status as string}
            ORDER BY r.created_at DESC
          `;
        } else {
          receipts = await sql`
            SELECT r.*, u.name as uploaded_by_name
            FROM receipts r
            LEFT JOIN users u ON r.uploaded_by = u.id
            WHERE r.organization_id = ${req.organizationId}
            ORDER BY r.created_at DESC
          `;
        }
      }
    } else {
      // Solo mode (no org)
      if (status) {
        receipts = await sql`
          SELECT * FROM receipts
          WHERE user_id = ${req.userId} AND status = ${status as string}
          ORDER BY created_at DESC
        `;
      } else {
        receipts = await sql`
          SELECT * FROM receipts
          WHERE user_id = ${req.userId}
          ORDER BY created_at DESC
        `;
      }
    }

    console.log('Found', receipts.length, 'receipts');

    const results = Array.isArray(receipts) ? receipts : [];
    res.json(rewriteReceiptUrls(results));
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({ error: 'Failed to fetch receipts', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getReceiptById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    let receipts;
    if (req.organizationId) {
      receipts = await sql`
        SELECT r.*, u.name as uploaded_by_name
        FROM receipts r
        LEFT JOIN users u ON r.uploaded_by = u.id
        WHERE r.id = ${id} AND r.organization_id = ${req.organizationId}
      `;
      // Employee can only see own receipts
      if (receipts.length > 0 && req.orgRole === 'org:employee' && receipts[0].uploaded_by !== req.userId) {
        return res.status(403).json({ error: 'You can only view your own receipts' });
      }
    } else {
      receipts = await sql`
        SELECT * FROM receipts
        WHERE id = ${id} AND user_id = ${req.userId}
      `;
    }

    if (receipts.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json(rewriteReceiptUrls(receipts)[0]);
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
};

export const createReceipt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('createReceipt called for user:', req.userId);
    console.log('createReceipt body:', req.body);

    const data = createReceiptSchema.parse(req.body);

    const receipt = await sql`
      INSERT INTO receipts (
        user_id, image_url, status, original_filename, vendor_name, transaction_date,
        subtotal, tax, total, currency, suggested_category,
        description, document_type, tax_treatment, tax_rate,
        publish_target, is_paid, payment_account_id, qb_account_id,
        organization_id, uploaded_by, paid_by
      )
      VALUES (
        ${req.userId}, ${data.imageUrl}, ${data.status}, ${data.originalFilename || null},
        ${data.vendorName || null}, ${data.transactionDate || null},
        ${data.subtotal || null}, ${data.tax || null}, ${data.total || null},
        ${data.currency || 'USD'}, ${data.suggestedCategory || null},
        ${data.description || null}, ${data.documentType || null},
        ${data.taxTreatment || null}, ${data.taxRate || null},
        ${data.publishTarget || null}, ${data.isPaid || false},
        ${data.paymentAccountId || null}, ${data.qbAccountId || null},
        ${req.organizationId || null}, ${req.userId}, ${data.paidBy || null}
      )
      RETURNING *
    `;

    console.log('Receipt created:', receipt[0].id);

    logAuditEvent({
      organizationId: req.organizationId,
      userId: req.userId,
      action: 'receipt.upload',
      resourceType: 'receipt',
      resourceId: receipt[0].id,
      details: { vendorName: data.vendorName, filename: data.originalFilename },
      ipAddress: req.ip,
    });

    res.status(201).json(receipt[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Create receipt error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const detailedError = {
      error: 'Failed to create receipt',
      details: errorMessage,
      hint: errorMessage.includes('column') ? 'Database migration may be required. Run server/migrate.sh' : undefined
    };
    res.status(500).json(detailedError);
  }
};

export const updateReceipt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateReceiptSchema.parse(req.body);

    // Get current receipt first to merge with updates
    let currentReceipts;
    if (req.organizationId) {
      currentReceipts = await sql`
        SELECT * FROM receipts
        WHERE id = ${id} AND organization_id = ${req.organizationId}
      `;
    } else {
      currentReceipts = await sql`
        SELECT * FROM receipts
        WHERE id = ${id} AND user_id = ${req.userId}
      `;
    }

    if (currentReceipts.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const current = currentReceipts[0];

    // Auto-apply category rule if vendor name is being set and no category is explicitly provided
    let autoQbAccountId: string | null = null;
    let autoRuleId: string | null = null;
    let autoCategoryName: string | null = null;
    const vendorName = data.vendorName !== undefined ? data.vendorName : current.vendor_name;
    const hasExplicitCategory = data.qbAccountId !== undefined && data.qbAccountId !== null;
    const hasExistingCategory = current.qb_account_id !== null;

    if (vendorName && !hasExplicitCategory && !hasExistingCategory) {
      try {
        const rule = await matchRule(req.userId!, vendorName);
        if (rule && rule.qb_account_id) {
          autoQbAccountId = rule.qb_account_id;
          autoRuleId = rule.id;
          autoCategoryName = rule.category_name || null;
          await incrementRuleApplied(rule.id);
          console.log(`Auto-categorized receipt ${id}: "${vendorName}" → ${rule.category_name} (rule ${rule.id})`);
        }
      } catch (err) {
        console.error('Auto-categorization failed (non-fatal):', err);
      }
    }

    // When user explicitly sets a QB category, resolve its name for suggested_category
    let explicitCategoryName: string | null = null;
    if (hasExplicitCategory) {
      try {
        const catResult = await sql`
          SELECT name FROM qb_categories
          WHERE user_id = ${req.userId}
            AND qb_account_id = ${data.qbAccountId}
            AND active = true
          LIMIT 1
        `;
        if (catResult.length > 0) {
          explicitCategoryName = catResult[0].name;
        }
      } catch (err) {
        console.error('Category name lookup failed (non-fatal):', err);
      }
    }

    // Determine final qb_account_id and auto_categorized flag
    const finalQbAccountId = hasExplicitCategory
      ? data.qbAccountId
      : (autoQbAccountId || current.qb_account_id);
    const isAutoCategorized = autoQbAccountId !== null;

    // Determine final suggested_category: prefer resolved category name over OCR suggestion
    const finalSuggestedCategory = explicitCategoryName
      || autoCategoryName
      || (data.suggestedCategory !== undefined ? data.suggestedCategory : current.suggested_category);

    // Update with merged values
    const receipt = await sql`
      UPDATE receipts
      SET
        status = ${data.status !== undefined ? data.status : current.status},
        vendor_name = ${data.vendorName !== undefined ? data.vendorName : current.vendor_name},
        transaction_date = ${data.transactionDate !== undefined ? data.transactionDate : current.transaction_date},
        subtotal = ${data.subtotal !== undefined ? data.subtotal : current.subtotal},
        tax = ${data.tax !== undefined ? data.tax : current.tax},
        total = ${data.total !== undefined ? data.total : current.total},
        currency = ${data.currency !== undefined ? data.currency : current.currency},
        suggested_category = ${finalSuggestedCategory},
        description = ${data.description !== undefined ? data.description : current.description},
        document_type = ${data.documentType !== undefined ? data.documentType : current.document_type},
        tax_treatment = ${data.taxTreatment !== undefined ? data.taxTreatment : current.tax_treatment},
        tax_rate = ${data.taxRate !== undefined ? data.taxRate : current.tax_rate},
        publish_target = ${data.publishTarget !== undefined ? data.publishTarget : current.publish_target},
        is_paid = ${data.isPaid !== undefined ? data.isPaid : current.is_paid},
        payment_account_id = ${data.paymentAccountId !== undefined ? data.paymentAccountId : current.payment_account_id},
        qb_account_id = ${finalQbAccountId},
        paid_by = ${data.paidBy !== undefined ? data.paidBy : current.paid_by},
        auto_categorized = ${isAutoCategorized || current.auto_categorized || false},
        auto_categorized_rule_id = ${autoRuleId || current.auto_categorized_rule_id || null}
      WHERE id = ${id}
      RETURNING *
    `;

    // Map of API field names → DB column names for diff comparison
    const FIELD_DB_MAP: Record<string, string> = {
      vendorName: 'vendor_name',
      transactionDate: 'transaction_date',
      subtotal: 'subtotal',
      tax: 'tax',
      total: 'total',
      currency: 'currency',
      suggestedCategory: 'suggested_category',
      description: 'description',
      documentType: 'document_type',
      taxTreatment: 'tax_treatment',
      taxRate: 'tax_rate',
      publishTarget: 'publish_target',
      isPaid: 'is_paid',
      paymentAccountId: 'payment_account_id',
      qbAccountId: 'qb_account_id',
      paidBy: 'paid_by',
      status: 'status',
      imageUrl: 'image_url',
      originalFilename: 'original_filename',
    };

    // Compute which fields actually changed vs current DB state
    const changedFields = Object.keys(data)
      .filter(k => (data as any)[k] !== undefined)
      .filter(k => {
        const dbCol = FIELD_DB_MAP[k];
        if (!dbCol) return true; // unknown field — include to be safe
        const oldVal = current[dbCol];
        const newVal = (data as any)[k];
        if (oldVal == null && newVal == null) return false;
        return String(oldVal) !== String(newVal);
      });

    // Only log if something actually changed
    if (changedFields.length > 0) {
      logAuditEvent({
        organizationId: req.organizationId,
        userId: req.userId,
        action: 'receipt.update',
        resourceType: 'receipt',
        resourceId: id,
        details: {
          fields: changedFields,
          vendorName: receipt[0].vendor_name,
          filename: receipt[0].original_filename,
          total: receipt[0].total,
        },
        ipAddress: req.ip,
      });
    }

    res.json(receipt[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Update receipt error:', error);
    res.status(500).json({ error: 'Failed to update receipt', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteReceipt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    let result;
    if (req.organizationId) {
      result = await sql`
        DELETE FROM receipts
        WHERE id = ${id} AND organization_id = ${req.organizationId}
        RETURNING id, vendor_name, original_filename, total
      `;
    } else {
      result = await sql`
        DELETE FROM receipts
        WHERE id = ${id} AND user_id = ${req.userId}
        RETURNING id, vendor_name, original_filename, total
      `;
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const deleted = result[0];

    logAuditEvent({
      organizationId: req.organizationId,
      userId: req.userId,
      action: 'receipt.delete',
      resourceType: 'receipt',
      resourceId: id,
      details: {
        vendorName: deleted.vendor_name,
        filename: deleted.original_filename,
        total: deleted.total,
      },
      ipAddress: req.ip,
    });

    res.json({ message: 'Receipt deleted successfully' });
  } catch (error) {
    console.error('Delete receipt error:', error);
    res.status(500).json({ error: 'Failed to delete receipt' });
  }
};

export const getUploadUrl = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fileName, fileType } = req.query;

    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'fileName and fileType are required' });
    }

    const key = `receipts/${req.userId}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: fileType as string,
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : uploadUrl.split('?')[0];

    res.json({ uploadUrl, publicUrl, key });
  } catch (error) {
    console.error('Get upload URL error:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

// New endpoint: Check for duplicates
const checkDuplicatesSchema = z.object({
  files: z.array(z.object({
    filename: z.string(),
    transactionDetails: z.object({
      vendorName: z.string().optional(),
      transactionDate: z.string().optional(),
      subtotal: z.number().optional(),
      tax: z.number().optional(),
      total: z.number().optional(),
    }).optional(),
  })),
});

export const checkDuplicates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = checkDuplicatesSchema.parse(req.body);

    const results = await Promise.all(
      data.files.map(async (file) => {
        const duplicateCheck = await checkForDuplicate(
          req.userId!,
          file.filename,
          file.transactionDetails,
          req.organizationId
        );

        return {
          filename: file.filename,
          ...duplicateCheck,
        };
      })
    );

    res.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Check duplicates error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const detailedError = {
      error: 'Failed to check duplicates',
      details: errorMessage,
      hint: errorMessage.includes('column') ? 'Database migration may be required. Run server/migrate.sh' : undefined
    };
    res.status(500).json(detailedError);
  }
};

