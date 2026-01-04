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

export const getReceipts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query;
    
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

    res.json(receipts);
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({ error: 'Failed to fetch receipts' });
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
    const data = createReceiptSchema.parse(req.body);

    const receipt = await sql`
      INSERT INTO receipts (
        user_id, image_url, status, vendor_name, transaction_date,
        subtotal, tax, total, currency, suggested_category,
        description, document_type, tax_treatment, tax_rate,
        publish_target, is_paid, payment_account_id, qb_account_id
      )
      VALUES (
        ${req.userId}, ${data.imageUrl}, ${data.status},
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

    res.status(201).json(receipt[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Create receipt error:', error);
    res.status(500).json({ error: 'Failed to create receipt' });
  }
};

export const updateReceipt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateReceiptSchema.parse(req.body);

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.vendorName !== undefined) {
      updates.push(`vendor_name = $${paramIndex++}`);
      values.push(data.vendorName);
    }
    if (data.transactionDate !== undefined) {
      updates.push(`transaction_date = $${paramIndex++}`);
      values.push(data.transactionDate);
    }
    if (data.subtotal !== undefined) {
      updates.push(`subtotal = $${paramIndex++}`);
      values.push(data.subtotal);
    }
    if (data.tax !== undefined) {
      updates.push(`tax = $${paramIndex++}`);
      values.push(data.tax);
    }
    if (data.total !== undefined) {
      updates.push(`total = $${paramIndex++}`);
      values.push(data.total);
    }
    if (data.currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`);
      values.push(data.currency);
    }
    if (data.suggestedCategory !== undefined) {
      updates.push(`suggested_category = $${paramIndex++}`);
      values.push(data.suggestedCategory);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.documentType !== undefined) {
      updates.push(`document_type = $${paramIndex++}`);
      values.push(data.documentType);
    }
    if (data.taxTreatment !== undefined) {
      updates.push(`tax_treatment = $${paramIndex++}`);
      values.push(data.taxTreatment);
    }
    if (data.taxRate !== undefined) {
      updates.push(`tax_rate = $${paramIndex++}`);
      values.push(data.taxRate);
    }
    if (data.publishTarget !== undefined) {
      updates.push(`publish_target = $${paramIndex++}`);
      values.push(data.publishTarget);
    }
    if (data.isPaid !== undefined) {
      updates.push(`is_paid = $${paramIndex++}`);
      values.push(data.isPaid);
    }
    if (data.paymentAccountId !== undefined) {
      updates.push(`payment_account_id = $${paramIndex++}`);
      values.push(data.paymentAccountId);
    }
    if (data.qbAccountId !== undefined) {
      updates.push(`qb_account_id = $${paramIndex++}`);
      values.push(data.qbAccountId);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, req.userId);

    const receipt = await sql`
      UPDATE receipts
      SET ${sql.unsafe(updates.join(', '))}
      WHERE id = ${id} AND user_id = ${req.userId}
      RETURNING *
    `;

    if (receipt.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json(receipt[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Update receipt error:', error);
    res.status(500).json({ error: 'Failed to update receipt' });
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

