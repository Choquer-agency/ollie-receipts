export interface ParsedReceiptData {
  vendor_name: string;
  transaction_date: string;
  total: number;
  tax: number;
  currency: string;
  suggested_category: string;
  description: string;
}
