import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sql } from '../db/index.js';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from '../config/r2.js';
import { z } from 'zod';

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
  }
): Promise<DuplicateCheckResult> => {
  // Check 1: Filename match
  if (filename) {
    const filenameMatches = await sql`
      SELECT id FROM receipts
      WHERE user_id = ${userId}
      AND original_filename = ${filename}
      LIMIT 1
    `;
    
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
    const detailsMatches = await sql`
      SELECT id FROM receipts
      WHERE user_id = ${userId}
      AND vendor_name = ${transactionDetails.vendorName}
      AND transaction_date = ${transactionDetails.transactionDate}
      AND total = ${transactionDetails.total}
      AND COALESCE(tax, 0) = ${transactionDetails.tax || 0}
      AND COALESCE(subtotal, 0) = ${transactionDetails.subtotal || 0}
      LIMIT 1
    `;
    
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
    
    console.log('getReceipts called for user:', req.userId);
    
    let receipts;
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

    console.log('Found', receipts.length, 'receipts');
    
    // Always return an array
    res.json(Array.isArray(receipts) ? receipts : []);
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({ error: 'Failed to fetch receipts', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getReceiptById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const receipts = await sql`
      SELECT * FROM receipts 
      WHERE id = ${id} AND user_id = ${req.userId}
    `;

    if (receipts.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json(receipts[0]);
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
        publish_target, is_paid, payment_account_id, qb_account_id
      )
      VALUES (
        ${req.userId}, ${data.imageUrl}, ${data.status}, ${data.originalFilename || null},
        ${data.vendorName || null}, ${data.transactionDate || null},
        ${data.subtotal || null}, ${data.tax || null}, ${data.total || null},
        ${data.currency || 'USD'}, ${data.suggestedCategory || null},
        ${data.description || null}, ${data.documentType || null},
        ${data.taxTreatment || null}, ${data.taxRate || null},
        ${data.publishTarget || null}, ${data.isPaid || false},
        ${data.paymentAccountId || null}, ${data.qbAccountId || null}
      )
      RETURNING *
    `;

    console.log('Receipt created:', receipt[0].id);
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
    const currentReceipts = await sql`
      SELECT * FROM receipts 
      WHERE id = ${id} AND user_id = ${req.userId}
    `;

    if (currentReceipts.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const current = currentReceipts[0];

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
        suggested_category = ${data.suggestedCategory !== undefined ? data.suggestedCategory : current.suggested_category},
        description = ${data.description !== undefined ? data.description : current.description},
        document_type = ${data.documentType !== undefined ? data.documentType : current.document_type},
        tax_treatment = ${data.taxTreatment !== undefined ? data.taxTreatment : current.tax_treatment},
        tax_rate = ${data.taxRate !== undefined ? data.taxRate : current.tax_rate},
        publish_target = ${data.publishTarget !== undefined ? data.publishTarget : current.publish_target},
        is_paid = ${data.isPaid !== undefined ? data.isPaid : current.is_paid},
        payment_account_id = ${data.paymentAccountId !== undefined ? data.paymentAccountId : current.payment_account_id},
        qb_account_id = ${data.qbAccountId !== undefined ? data.qbAccountId : current.qb_account_id}
      WHERE id = ${id} AND user_id = ${req.userId}
      RETURNING *
    `;

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

    const result = await sql`
      DELETE FROM receipts
      WHERE id = ${id} AND user_id = ${req.userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

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
          file.transactionDetails
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

