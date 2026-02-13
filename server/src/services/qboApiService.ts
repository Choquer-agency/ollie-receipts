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
  SyncToken: string;
  TxnDate: string;
  TotalAmt: number;
  PrivateNote?: string;
}

export interface QBBillPayment {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  PayType: string;
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
    console.error(`❌ No valid QuickBooks connection for user ${userId}`);
    throw new Error('No valid QuickBooks connection found. Please reconnect to QuickBooks.');
  }
  
  const { accessToken, realmId } = tokenData;
  const baseUrl = QB_CONFIG.getApiUrl();
  const url = `${baseUrl}/v3/company/${realmId}${endpoint}`;
  
  console.log(`🔄 Making QuickBooks ${method} request to: ${endpoint}`);
  
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
      console.error(`❌ QuickBooks API error (${response.status}):`, errorText);
      
      // Parse error response if JSON
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = JSON.stringify(errorJson, null, 2);
        
        // Check for specific authentication errors
        if (errorJson.Fault?.Error?.[0]?.code === '3200' || response.status === 401) {
          console.error('❌ Authentication error - token may be invalid or expired');
          throw new Error('QuickBooks authentication failed. Please reconnect to QuickBooks.');
        }
      } catch (e) {
        // Not JSON, use text as-is
      }
      
      throw new Error(`QuickBooks API error: ${response.status} ${response.statusText} - ${errorDetails}`);
    }
    
    console.log(`✅ QuickBooks ${method} request successful: ${endpoint}`);
    return await response.json();
  } catch (error) {
    console.error('❌ Error making QuickBooks request:', error);
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
  }
): Promise<QBPurchase> {
  try {
    // Get or create vendor
    const vendorId = await findOrCreateVendor(userId, receiptData.vendorName);

    // Build private note with description (image is attached separately)
    const privateNote = receiptData.description || '';
    
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
  }
): Promise<{ bill: QBBill; vendorId: string }> {
  try {
    // Get or create vendor
    const vendorId = await findOrCreateVendor(userId, receiptData.vendorName);

    // Build private note with description (image is attached separately)
    const privateNote = receiptData.description || '';

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

    return { bill: response.Bill, vendorId };
  } catch (error) {
    console.error('Error creating bill:', error);
    throw new Error('Failed to create bill in QuickBooks');
  }
}

/**
 * Create BillPayment to mark a Bill as paid
 */
export async function createBillPayment(
  userId: string,
  data: {
    vendorId: string;
    billId: string;
    totalAmt: number;
    txnDate: string;
    paymentAccountId: string;
    paymentAccountType: 'Bank' | 'Credit Card';
  }
): Promise<QBBillPayment> {
  try {
    const payType = data.paymentAccountType === 'Credit Card' ? 'CreditCard' : 'Check';

    const paymentData: any = {
      VendorRef: { value: data.vendorId },
      PayType: payType,
      TotalAmt: data.totalAmt,
      TxnDate: data.txnDate,
      Line: [
        {
          Amount: data.totalAmt,
          LinkedTxn: [
            {
              TxnId: data.billId,
              TxnType: 'Bill',
            },
          ],
        },
      ],
    };

    if (payType === 'CreditCard') {
      paymentData.CreditCardPayment = {
        CCAccountRef: { value: data.paymentAccountId },
      };
    } else {
      paymentData.CheckPayment = {
        BankAccountRef: { value: data.paymentAccountId },
      };
    }

    const response = await makeQBRequest(userId, '/billpayment', 'POST', paymentData);
    return response.BillPayment;
  } catch (error) {
    console.error('Error creating bill payment:', error);
    throw new Error('Failed to create bill payment in QuickBooks');
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
 * Download image from URL and return as Buffer with content type
 */
async function downloadImage(imageUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
  fileName: string;
}> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  // Extract filename from URL
  const urlPath = new URL(imageUrl).pathname;
  const fileName = decodeURIComponent(urlPath.split('/').pop() || 'receipt.jpg');

  return { buffer, contentType, fileName };
}

/**
 * Upload receipt image as attachment to a QuickBooks transaction
 */
async function uploadAttachmentToQB(
  userId: string,
  transactionId: string,
  transactionType: 'Purchase' | 'Bill',
  imageBuffer: Buffer,
  contentType: string,
  fileName: string,
): Promise<void> {
  const tokenData = await getValidAccessToken(userId);
  if (!tokenData) {
    throw new Error('No valid QuickBooks connection found.');
  }

  const { accessToken, realmId } = tokenData;
  const baseUrl = QB_CONFIG.getApiUrl();
  const url = `${baseUrl}/v3/company/${realmId}/upload`;

  const metadata = {
    AttachableRef: [
      {
        EntityRef: {
          type: transactionType,
          value: transactionId,
        },
        IncludeOnSend: false,
      },
    ],
    FileName: fileName,
    ContentType: contentType,
  };

  // QuickBooks expects multipart/form-data with specific field names
  const formData = new FormData();

  formData.append(
    'file_metadata_01',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
    'metadata.json'
  );

  formData.append(
    'file_content_01',
    new Blob([imageBuffer], { type: contentType }),
    fileName
  );

  // Use native fetch for FormData/multipart support
  const response = await globalThis.fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ QuickBooks attachment upload error (${response.status}):`, errorText);
    throw new Error(`Failed to upload attachment: ${response.status} ${response.statusText}`);
  }

  console.log('✅ Receipt image attached to QuickBooks transaction');
}

/**
 * Attach receipt image to a QuickBooks transaction (non-fatal on failure)
 */
async function attachReceiptImage(
  userId: string,
  transactionId: string,
  transactionType: 'Purchase' | 'Bill',
  imageUrl?: string,
): Promise<void> {
  if (!imageUrl) return;

  try {
    console.log('📎 Downloading receipt image for attachment...');
    const { buffer, contentType, fileName } = await downloadImage(imageUrl);

    console.log('📎 Uploading receipt image to QuickBooks...');
    await uploadAttachmentToQB(userId, transactionId, transactionType, buffer, contentType, fileName);
  } catch (attachError) {
    // Non-fatal: log but don't fail the publish
    console.error('⚠️ Failed to attach receipt image (non-fatal):', attachError);
  }
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
    paymentAccountType?: 'Bank' | 'Credit Card';
    isPaid: boolean;
    publishTarget: 'Expense' | 'Bill';
    description?: string;
    imageUrl?: string;
    paidBy?: string;
  },
  organizationId?: string
): Promise<{ transactionId: string; transactionType: 'Purchase' | 'Bill' }> {
  try {
    // Validate receipt data
    if (!receiptData.vendorName || !receiptData.transactionDate || !receiptData.total) {
      throw new Error('Missing required receipt data (vendor, date, or total)');
    }

    if (!receiptData.expenseAccountId) {
      throw new Error('Expense account (category) is required');
    }

    if (!receiptData.paymentAccountId) {
      throw new Error('Payment account is required');
    }

    console.log('📝 Publishing receipt with target:', receiptData.publishTarget);
    console.log('📝 paymentAccountId:', !!receiptData.paymentAccountId, 'paymentAccountType:', receiptData.paymentAccountType);

    // Build description with "Paid by" annotation
    let description = receiptData.description || '';
    if (receiptData.paidBy) {
      const paidByNote = `Paid by: ${receiptData.paidBy}`;
      description = description ? `${description}\n${paidByNote}` : paidByNote;
    }

    let transactionId: string;
    let transactionType: 'Purchase' | 'Bill';

    if (receiptData.publishTarget === 'Expense') {
      // Create Purchase for expenses (paid transactions)
      console.log('💰 Creating Purchase (Expense) in QuickBooks...');
      const purchase = await createPurchase(userId, {
        vendorName: receiptData.vendorName,
        transactionDate: receiptData.transactionDate,
        total: receiptData.total,
        expenseAccountId: receiptData.expenseAccountId,
        paymentAccountId: receiptData.paymentAccountId,
        description,
      });

      console.log('✅ Purchase created with ID:', purchase.Id);
      transactionId = purchase.Id;
      transactionType = 'Purchase';
    } else {
      // Create Bill (accounts payable) then auto-pay with BillPayment
      console.log('📄 Creating Bill in QuickBooks...');
      const { bill, vendorId } = await createBill(userId, {
        vendorName: receiptData.vendorName,
        transactionDate: receiptData.transactionDate,
        total: receiptData.total,
        expenseAccountId: receiptData.expenseAccountId,
        description,
      });

      console.log('✅ Bill created with ID:', bill.Id);

      // Create BillPayment to mark the Bill as paid
      console.log('💳 Creating BillPayment to mark Bill as paid...');
      try {
        const billPayment = await createBillPayment(userId, {
          vendorId,
          billId: bill.Id,
          totalAmt: receiptData.total,
          txnDate: receiptData.transactionDate,
          paymentAccountId: receiptData.paymentAccountId,
          paymentAccountType: receiptData.paymentAccountType || 'Credit Card',
        });
        console.log('✅ BillPayment created with ID:', billPayment.Id);
      } catch (paymentError) {
        // BillPayment failed — clean up the orphaned Bill
        console.error('❌ BillPayment failed, attempting to delete orphaned Bill...');
        try {
          await makeQBRequest(userId, '/bill?operation=delete', 'POST', {
            Id: bill.Id,
            SyncToken: bill.SyncToken,
          });
          console.log('✅ Orphaned Bill deleted');
        } catch (deleteError) {
          console.error('❌ Failed to delete orphaned Bill:', deleteError);
        }
        throw new Error('Failed to create payment for the bill. Please try again.');
      }

      transactionId = bill.Id;
      transactionType = 'Bill';
    }

    // Attach receipt image (non-fatal on failure)
    await attachReceiptImage(userId, transactionId, transactionType, receiptData.imageUrl);

    return { transactionId, transactionType };
  } catch (error) {
    console.error('Error publishing receipt to QuickBooks:', error);
    throw error;
  }
}

