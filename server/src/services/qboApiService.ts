import fetch from 'node-fetch';
import { getValidAccessToken } from './qboAuthService.js';
import { QB_CONFIG } from '../config/quickbooks.js';

export interface QBAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType: string;
  Active: boolean;
}

export interface QBVendor {
  Id: string;
  DisplayName: string;
}

export interface QBPurchase {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  PrivateNote?: string;
}

export interface QBBill {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  PrivateNote?: string;
}

/**
 * Make authenticated request to QuickBooks API
 */
async function makeQBRequest(
  userId: string,
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
): Promise<any> {
  const tokenData = await getValidAccessToken(userId);
  
  if (!tokenData) {
    throw new Error('No valid QuickBooks connection found');
  }
  
  const { accessToken, realmId } = tokenData;
  const baseUrl = QB_CONFIG.getApiUrl();
  const url = `${baseUrl}/v3/company/${realmId}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  
  const options: any = {
    method,
    headers,
  };
  
  if (body && method === 'POST') {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('QuickBooks API error:', errorText);
      throw new Error(`QuickBooks API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error making QuickBooks request:', error);
    throw error;
  }
}

/**
 * Fetch Chart of Accounts (expense accounts)
 */
export async function fetchExpenseAccounts(userId: string): Promise<QBAccount[]> {
  try {
    const query = `SELECT * FROM Account WHERE AccountType = 'Expense' AND Active = true`;
    const response = await makeQBRequest(
      userId,
      `/query?query=${encodeURIComponent(query)}`,
      'GET'
    );
    
    return response.QueryResponse?.Account || [];
  } catch (error) {
    console.error('Error fetching expense accounts:', error);
    throw new Error('Failed to fetch expense accounts from QuickBooks');
  }
}

/**
 * Fetch payment accounts (bank and credit card accounts)
 */
export async function fetchPaymentAccounts(userId: string): Promise<QBAccount[]> {
  try {
    const query = `SELECT * FROM Account WHERE AccountType IN ('Bank', 'Credit Card') AND Active = true`;
    const response = await makeQBRequest(
      userId,
      `/query?query=${encodeURIComponent(query)}`,
      'GET'
    );
    
    return response.QueryResponse?.Account || [];
  } catch (error) {
    console.error('Error fetching payment accounts:', error);
    throw new Error('Failed to fetch payment accounts from QuickBooks');
  }
}

/**
 * Find or create vendor by name
 */
export async function findOrCreateVendor(
  userId: string,
  vendorName: string
): Promise<string> {
  try {
    // First, try to find existing vendor
    const query = `SELECT * FROM Vendor WHERE DisplayName = '${vendorName.replace(/'/g, "\\'")}'`;
    const response = await makeQBRequest(
      userId,
      `/query?query=${encodeURIComponent(query)}`,
      'GET'
    );
    
    const vendors = response.QueryResponse?.Vendor || [];
    
    if (vendors.length > 0) {
      return vendors[0].Id;
    }
    
    // Vendor doesn't exist, create it
    const createResponse = await makeQBRequest(
      userId,
      '/vendor',
      'POST',
      {
        DisplayName: vendorName,
      }
    );
    
    return createResponse.Vendor.Id;
  } catch (error) {
    console.error('Error finding/creating vendor:', error);
    throw new Error('Failed to find or create vendor in QuickBooks');
  }
}

/**
 * Create Purchase transaction (for paid expenses)
 */
export async function createPurchase(
  userId: string,
  receiptData: {
    vendorName: string;
    transactionDate: string;
    total: number;
    expenseAccountId: string;
    paymentAccountId: string;
    description?: string;
    imageUrl?: string;
  }
): Promise<QBPurchase> {
  try {
    // Get or create vendor
    const vendorId = await findOrCreateVendor(userId, receiptData.vendorName);
    
    // Build private note with description and image URL
    let privateNote = receiptData.description || '';
    if (receiptData.imageUrl) {
      privateNote += `\n\nReceipt Image: ${receiptData.imageUrl}`;
    }
    
    // Create Purchase entity
    const purchaseData = {
      PaymentType: 'Cash', // or 'CreditCard' based on account type
      AccountRef: {
        value: receiptData.paymentAccountId,
      },
      EntityRef: {
        value: vendorId,
        type: 'Vendor',
      },
      TxnDate: receiptData.transactionDate,
      TotalAmt: receiptData.total,
      Line: [
        {
          Amount: receiptData.total,
          DetailType: 'AccountBasedExpenseLineDetail',
          AccountBasedExpenseLineDetail: {
            AccountRef: {
              value: receiptData.expenseAccountId,
            },
          },
        },
      ],
      ...(privateNote && { PrivateNote: privateNote.substring(0, 4000) }), // Max 4000 chars
    };
    
    const response = await makeQBRequest(userId, '/purchase', 'POST', purchaseData);
    
    return response.Purchase;
  } catch (error) {
    console.error('Error creating purchase:', error);
    throw new Error('Failed to create purchase in QuickBooks');
  }
}

/**
 * Create Bill transaction (for unpaid expenses)
 */
export async function createBill(
  userId: string,
  receiptData: {
    vendorName: string;
    transactionDate: string;
    total: number;
    expenseAccountId: string;
    dueDate?: string;
    description?: string;
    imageUrl?: string;
  }
): Promise<QBBill> {
  try {
    // Get or create vendor
    const vendorId = await findOrCreateVendor(userId, receiptData.vendorName);
    
    // Build private note with description and image URL
    let privateNote = receiptData.description || '';
    if (receiptData.imageUrl) {
      privateNote += `\n\nReceipt Image: ${receiptData.imageUrl}`;
    }
    
    // Calculate due date (default to 30 days from transaction date if not provided)
    const dueDate = receiptData.dueDate || calculateDueDate(receiptData.transactionDate, 30);
    
    // Create Bill entity
    const billData = {
      VendorRef: {
        value: vendorId,
      },
      TxnDate: receiptData.transactionDate,
      DueDate: dueDate,
      TotalAmt: receiptData.total,
      Line: [
        {
          Amount: receiptData.total,
          DetailType: 'AccountBasedExpenseLineDetail',
          AccountBasedExpenseLineDetail: {
            AccountRef: {
              value: receiptData.expenseAccountId,
            },
          },
        },
      ],
      ...(privateNote && { PrivateNote: privateNote.substring(0, 4000) }), // Max 4000 chars
    };
    
    const response = await makeQBRequest(userId, '/bill', 'POST', billData);
    
    return response.Bill;
  } catch (error) {
    console.error('Error creating bill:', error);
    throw new Error('Failed to create bill in QuickBooks');
  }
}

/**
 * Get company info (for displaying connection details)
 */
export async function getCompanyInfo(userId: string): Promise<{
  CompanyName: string;
  LegalName: string;
  Country: string;
}> {
  try {
    const response = await makeQBRequest(userId, '/companyinfo/1', 'GET');
    return response.CompanyInfo;
  } catch (error) {
    console.error('Error fetching company info:', error);
    throw new Error('Failed to fetch company info from QuickBooks');
  }
}

/**
 * Helper function to calculate due date
 */
function calculateDueDate(transactionDate: string, daysFromNow: number): string {
  const date = new Date(transactionDate);
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

/**
 * Publish receipt to QuickBooks (creates Purchase or Bill based on receipt data)
 */
export async function publishReceiptToQuickBooks(
  userId: string,
  receiptData: {
    vendorName: string;
    transactionDate: string;
    total: number;
    expenseAccountId: string;
    paymentAccountId?: string;
    isPaid: boolean;
    publishTarget: 'Expense' | 'Bill';
    description?: string;
    imageUrl?: string;
  }
): Promise<{ transactionId: string; transactionType: 'Purchase' | 'Bill' }> {
  try {
    // Validate receipt data
    if (!receiptData.vendorName || !receiptData.transactionDate || !receiptData.total) {
      throw new Error('Missing required receipt data (vendor, date, or total)');
    }
    
    if (!receiptData.expenseAccountId) {
      throw new Error('Expense account (category) is required');
    }
    
    // Determine whether to create Purchase or Bill
    if (receiptData.isPaid && receiptData.paymentAccountId) {
      // Create Purchase for paid expenses
      const purchase = await createPurchase(userId, {
        vendorName: receiptData.vendorName,
        transactionDate: receiptData.transactionDate,
        total: receiptData.total,
        expenseAccountId: receiptData.expenseAccountId,
        paymentAccountId: receiptData.paymentAccountId,
        description: receiptData.description,
        imageUrl: receiptData.imageUrl,
      });
      
      return {
        transactionId: purchase.Id,
        transactionType: 'Purchase',
      };
    } else {
      // Create Bill for unpaid expenses
      const bill = await createBill(userId, {
        vendorName: receiptData.vendorName,
        transactionDate: receiptData.transactionDate,
        total: receiptData.total,
        expenseAccountId: receiptData.expenseAccountId,
        description: receiptData.description,
        imageUrl: receiptData.imageUrl,
      });
      
      return {
        transactionId: bill.Id,
        transactionType: 'Bill',
      };
    }
  } catch (error) {
    console.error('Error publishing receipt to QuickBooks:', error);
    throw error;
  }
}

