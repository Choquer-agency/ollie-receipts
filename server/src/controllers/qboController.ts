import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  storeConnection,
  getConnection,
  revokeConnection,
  extractUserIdFromState,
} from '../services/qboAuthService.js';
import {
  fetchExpenseAccounts,
  fetchPaymentAccounts,
  publishReceiptToQuickBooks,
  getCompanyInfo,
} from '../services/qboApiService.js';
import { sql } from '../db/index.js';
import { z } from 'zod';

/**
 * Helper function to get internal user ID from Clerk user ID
 */
async function getInternalUserId(clerkUserId: string): Promise<string> {
  const users = await sql`
    SELECT id FROM users WHERE clerk_user_id = ${clerkUserId}
  `;
  
  if (users.length === 0) {
    throw new Error('User not found');
  }
  
  return users[0].id;
}

/**
 * Generate OAuth authorization URL
 */
export const getAuthUrl = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Pass user ID to encode in state parameter
    const authUrl = getAuthorizationUrl(req.userId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
};

/**
 * Handle OAuth callback from QuickBooks
 */
export const handleCallback = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, realmId, state, error } = req.query;
    
    console.log('📥 OAuth callback received:', { code: !!code, realmId, state: !!state, error });
    
    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return res.send(`
        <html>
          <head><title>QuickBooks Connection Error</title></head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'qbo_error', error: '${error}' }, '*');
                window.close();
              } else {
                window.location.href = '/?qbo_error=true&error=${error}';
              }
            </script>
            <p>Connection failed. This window should close automatically...</p>
          </body>
        </html>
      `);
    }
    
    if (!code || !realmId || !state) {
      console.error('Missing required OAuth parameters:', { code: !!code, realmId: !!realmId, state: !!state });
      return res.status(400).send(`
        <html>
          <head><title>Invalid OAuth Response</title></head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'qbo_error', error: 'missing_params' }, '*');
                window.close();
              }
            </script>
            <p>Invalid OAuth response. Missing required parameters.</p>
          </body>
        </html>
      `);
    }
    
    // Extract user ID from state parameter
    const userId = extractUserIdFromState(state as string);
    
    if (!userId) {
      console.error('❌ Could not extract user ID from state:', state);
      return res.send(`
        <html>
          <head><title>Authentication Required</title></head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'qbo_error', error: 'no_user_in_state' }, '*');
                window.close();
              } else {
                window.location.href = '/?qbo_error=true&error=no_user';
              }
            </script>
            <p>Authentication required. This window should close automatically...</p>
          </body>
        </html>
      `);
    }
    
    console.log('✓ User ID extracted from state:', userId);
    
    // Exchange code for tokens
    console.log('🔄 Exchanging authorization code for tokens...');
    const { tokens } = await exchangeCodeForTokens(code as string);
    console.log('✓ Tokens received from QuickBooks');
    
    // Store connection
    console.log('💾 Storing connection in database...');
    await storeConnection(
      userId,
      realmId as string,
      tokens
    );
    console.log('✓ Connection stored');
    
    // Try to get and update company name
    let companyName = '';
    try {
      const companyInfo = await getCompanyInfo(userId);
      companyName = companyInfo.CompanyName;
      console.log('✓ Company name retrieved:', companyName);
      
      await storeConnection(
        userId,
        realmId as string,
        tokens,
        companyName
      );
    } catch (error) {
      console.error('⚠ Error fetching company info (non-fatal):', error);
      // Continue even if we can't get company info
    }
    
    console.log('✅ QuickBooks connected successfully for user:', userId);
    
    // Send HTML that closes popup and notifies parent window
    res.send(`
      <html>
        <head><title>QuickBooks Connected</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'qbo_connected', 
                success: true,
                companyName: '${companyName}'
              }, '*');
              setTimeout(() => window.close(), 500);
            } else {
              window.location.href = '/?qbo_connected=true';
            }
          </script>
          <p>✅ QuickBooks connected successfully!</p>
          <p>Company: ${companyName || 'Connected'}</p>
          <p><small>This window will close automatically...</small></p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    res.send(`
      <html>
        <head><title>Connection Error</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'qbo_error', error: 'callback_failed' }, '*');
              window.close();
            } else {
              window.location.href = '/?qbo_error=true';
            }
          </script>
          <p>Connection failed. This window should close automatically...</p>
          <p style="color: red; font-size: 12px;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </body>
      </html>
    `);
  }
};

/**
 * Check QuickBooks connection status
 */
export const getConnectionStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const internalUserId = await getInternalUserId(req.userId!);
    const connection = await getConnection(internalUserId);
    
    if (!connection) {
      return res.json({
        connected: false,
      });
    }
    
    res.json({
      connected: true,
      companyName: connection.company_name,
      connectedAt: connection.connected_at,
      realmId: connection.realm_id,
    });
  } catch (error) {
    console.error('Error checking connection status:', error);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
};

/**
 * Disconnect QuickBooks
 */
export const disconnect = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const internalUserId = await getInternalUserId(req.userId!);
    const success = await revokeConnection(internalUserId);
    
    if (!success) {
      return res.status(404).json({ error: 'No connection found' });
    }
    
    res.json({ message: 'Successfully disconnected from QuickBooks' });
  } catch (error) {
    console.error('Error disconnecting:', error);
    res.status(500).json({ error: 'Failed to disconnect from QuickBooks' });
  }
};

/**
 * Fetch expense accounts (Chart of Accounts)
 */
export const getExpenseAccounts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const internalUserId = await getInternalUserId(req.userId!);
    const accounts = await fetchExpenseAccounts(internalUserId);
    
    // Transform to match frontend format
    const formattedAccounts = accounts.map(account => ({
      id: account.Id,
      name: `${account.Id} - ${account.Name}`,
      type: account.AccountType,
    }));
    
    res.json(formattedAccounts);
  } catch (error) {
    console.error('Error fetching expense accounts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch expense accounts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Fetch payment accounts (Bank and Credit Card accounts)
 */
export const getPaymentAccounts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const internalUserId = await getInternalUserId(req.userId!);
    const accounts = await fetchPaymentAccounts(internalUserId);
    
    // Transform to match frontend format
    const formattedAccounts = accounts.map(account => ({
      id: account.Id,
      name: account.Name,
      type: account.AccountType === 'Bank' ? 'Bank' : 'Credit Card',
    }));
    
    res.json(formattedAccounts);
  } catch (error) {
    console.error('Error fetching payment accounts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch payment accounts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Publish receipt to QuickBooks
 */
const publishReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  expenseAccountId: z.string(),
  paymentAccountId: z.string().optional(),
});

export const publishReceipt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = publishReceiptSchema.parse(req.body);
    const internalUserId = await getInternalUserId(req.userId!);
    
    // Get receipt from database
    const receipts = await sql`
      SELECT * FROM receipts
      WHERE id = ${data.receiptId} AND user_id = ${internalUserId}
    `;
    
    if (receipts.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    const receipt = receipts[0];
    
    // Validate receipt has required data
    if (!receipt.vendor_name || !receipt.transaction_date || !receipt.total) {
      return res.status(400).json({ 
        error: 'Receipt is missing required data (vendor, date, or total)' 
      });
    }
    
    // Publish to QuickBooks
    const result = await publishReceiptToQuickBooks(internalUserId, {
      vendorName: receipt.vendor_name,
      transactionDate: receipt.transaction_date,
      total: parseFloat(receipt.total),
      expenseAccountId: data.expenseAccountId,
      paymentAccountId: data.paymentAccountId,
      isPaid: receipt.is_paid || false,
      publishTarget: receipt.publish_target || 'Expense',
      description: receipt.description,
      imageUrl: receipt.image_url,
    });
    
    // Update receipt with QuickBooks transaction ID
    await sql`
      UPDATE receipts
      SET 
        qb_transaction_id = ${result.transactionId},
        qb_account_id = ${data.expenseAccountId},
        status = 'published'
      WHERE id = ${data.receiptId}
    `;
    
    res.json({
      success: true,
      transactionId: result.transactionId,
      transactionType: result.transactionType,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: error.errors 
      });
    }
    
    console.error('Error publishing receipt:', error);
    res.status(500).json({ 
      error: 'Failed to publish receipt to QuickBooks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

