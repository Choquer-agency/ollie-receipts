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
  image_url: string;
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
  tax_rate?: number;

  // Dext-like fields
  description?: string;
  document_type?: 'Receipt' | 'Invoice' | 'Credit Note';
  publish_target?: 'Expense' | 'Bill';
  is_paid?: boolean;
  payment_account_id?: string;

  // QBO Linkage
  qb_account_id?: string;
  qb_transaction_id?: string;

  // Auto-categorization
  auto_categorized?: boolean;
  auto_categorized_rule_id?: string;

  // Team/Org fields
  organization_id?: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  paid_by?: string;

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
  description: string;
}

export interface CachedCategory {
  id: string;           // qb_account_id
  name: string;         // "ID - Name" format (matches QB dropdown)
  displayName: string;  // clean name for display
  type: string;
  subType: string | null;
  lastSynced: string;
}

export interface CategoryRule {
  id: string;
  vendorPattern: string;
  qbCategoryId: string;
  categoryName: string;
  qbAccountId: string;
  matchType: 'exact' | 'contains';
  isActive: boolean;
  timesApplied: number;
  createdAt: string;
}

export interface RuleMatch {
  ruleId: string;
  vendorPattern: string;
  qbCategoryId: string;
  categoryName: string;
  qbAccountId: string;
  matchType: 'exact' | 'contains';
}

// Organization types
export type OrgRole = 'org:admin' | 'org:accountant' | 'org:bookkeeper' | 'org:employee';

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  role: string;
  imageUrl?: string;
}

export interface OrgInfo {
  id: string;
  name: string;
  role: OrgRole;
  memberCount: number;
}

export interface AuditLogEntry {
  id: string;
  organization_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, any>;
  created_at: string;
}

