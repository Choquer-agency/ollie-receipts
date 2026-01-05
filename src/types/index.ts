export enum ReceiptStatus {
  UPLOADED = 'uploaded',
  OCR_COMPLETE = 'ocr_complete',
  REVIEWED = 'reviewed',
  PUBLISHED = 'published',
  ERROR = 'error'
}

export type TaxTreatment = 'Inclusive' | 'Exclusive' | 'No Tax';

export interface Receipt {
  id: string;
  user_id: string;
  image_url: string; // Base64 for this MVP, URL in prod
  status: ReceiptStatus;
  
  // File metadata
  original_filename?: string;
  
  // OCR Extracted & Review Fields
  vendor_name?: string;
  transaction_date?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  currency?: string;
  suggested_category?: string;
  
  // Tax logic fields
  tax_treatment?: TaxTreatment;
  tax_rate?: number; // decimal like 0.05 or 0.13
  
  // Dext-like fields
  description?: string;
  document_type?: 'Receipt' | 'Invoice' | 'Credit Note';
  publish_target?: 'Expense' | 'Bill'; // "Publish to"
  is_paid?: boolean;
  payment_account_id?: string; // The "Payment Method" (e.g. Credit Card account ID)

  // QBO Linkage
  qb_account_id?: string; // The Expense Category (Chart of Accounts)
  qb_transaction_id?: string;
  
  created_at: string;
}

export interface QuickBooksAccount {
  id: string;
  name: string;
  type: string;
}

export interface PaymentAccount {
  id: string;
  name: string;
  type: 'Bank' | 'Credit Card' | 'Other';
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface ParsedReceiptData {
  vendor_name: string;
  transaction_date: string;
  total: number;
  tax: number;
  currency: string;
  suggested_category: string;
}

