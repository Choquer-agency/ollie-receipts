import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

export const sql = neon(process.env.DATABASE_URL);

export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string;
  created_at: Date;
}

export interface Receipt {
  id: string;
  user_id: string;
  image_url: string;
  status: string;
  vendor_name?: string;
  transaction_date?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  currency?: string;
  suggested_category?: string;
  description?: string;
  document_type?: string;
  tax_treatment?: string;
  tax_rate?: number;
  publish_target?: string;
  is_paid?: boolean;
  payment_account_id?: string;
  qb_account_id?: string;
  qb_transaction_id?: string;
  created_at: Date;
  updated_at: Date;
}

