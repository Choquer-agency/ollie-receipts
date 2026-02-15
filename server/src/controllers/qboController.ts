import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  storeConnection,
  getConnection,
  revokeConnection,
  extractUserIdFromState,
  getValidAccessToken,
} from '../services/qboAuthService.js';
import {
  fetchExpenseAccounts,
  fetchPaymentAccounts,
  publishReceiptToQuickBooks,
  getCompanyInfo,
} from '../services/qboApiService.js';
import { logAuditEvent } from '../services/auditService.js';
import { sql } from '../db/index.js';
import { z } from 'zod';

/**
 * Generate OAuth authorization URL
 */
export const getAuthUrl = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Encode both user ID and org ID in state parameter
    const statePayload = req.organizationId
      ? `${req.userId}_org_${req.organizationId}`
      : req.userId;
    const authUrl = getAuthorizationUrl(statePayload);
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
    
    // Extract user ID (and optionally org ID) from state parameter
    const statePayload = extractUserIdFromState(state as string);
    let userId: string | null = null;
    let organizationId: string | null = null;

    if (statePayload) {
      const orgMatch = statePayload.match(/^(.+)_org_(.+)$/);
      if (orgMatch) {
        userId = orgMatch[1];
        organizationId = orgMatch[2];
      } else {
        userId = statePayload;
      }
    }
    
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
    
    // Construct the full callback URL as received from QuickBooks
    // This is what the intuit-oauth library expects
    const protocol = req.protocol;
    const host = req.get('host');
    const fullCallbackUrl = `${protocol}://${host}${req.originalUrl}`;
    
    console.log('🔄 Full callback URL constructed for token exchange');
    
    // Exchange code for tokens using the full callback URL
    console.log('🔄 Exchanging authorization code for tokens...');
    const { tokens } = await exchangeCodeForTokens(fullCallbackUrl);
    console.log('✓ Tokens received from QuickBooks');
    
    // Store connection
    console.log('💾 Storing connection in database...');
    await storeConnection(
      userId,
      realmId as string,
      tokens,
      undefined,
      organizationId || undefined
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
        companyName,
        organizationId || undefined
      );
    } catch (error) {
      console.error('⚠ Error fetching company info (non-fatal):', error);
      // Continue even if we can't get company info
    }
    
    console.log('✅ QuickBooks connected successfully for user:', userId);

    logAuditEvent({
      organizationId: organizationId || undefined,
      userId,
      action: 'qbo.connect',
      details: { companyName },
    });

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
    const connection = await getConnection(req.userId!, req.organizationId);

    if (!connection) {
      return res.json({
        connected: false,
      });
    }

    // Validate that tokens are actually usable (attempt refresh if expired)
    const validToken = await getValidAccessToken(req.userId!, req.organizationId);
    if (!validToken) {
      console.warn(`⚠ QBO connection exists for user ${req.userId} but tokens are invalid/expired`);
      return res.json({
        connected: false,
        error: 'token_expired',
        companyName: connection.company_name,
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
    // Fetch connection info before revoking so we can log the company name
    const connection = await getConnection(req.userId!, req.organizationId);
    const companyName = connection?.company_name || '';

    const success = await revokeConnection(req.userId!, req.organizationId);

    if (!success) {
      return res.status(404).json({ error: 'No connection found' });
    }

    logAuditEvent({
      organizationId: req.organizationId,
      userId: req.userId,
      action: 'qbo.disconnect',
      details: { companyName },
      ipAddress: req.ip,
    });

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
    const accounts = await fetchExpenseAccounts(req.userId!);
    
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
    const accounts = await fetchPaymentAccounts(req.userId!);
    
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
  paymentAccountId: z.string(),
  paymentAccountType: z.enum(['Bank', 'Credit Card']).optional(),
});

export const publishReceipt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = publishReceiptSchema.parse(req.body);

    // Get receipt from database (org-aware)
    let receipts;
    if (req.organizationId) {
      receipts = await sql`
        SELECT * FROM receipts
        WHERE id = ${data.receiptId} AND organization_id = ${req.organizationId}
      `;
    } else {
      receipts = await sql`
        SELECT * FROM receipts
        WHERE id = ${data.receiptId} AND user_id = ${req.userId}
      `;
    }

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
    const result = await publishReceiptToQuickBooks(req.userId!, {
      vendorName: receipt.vendor_name,
      transactionDate: receipt.transaction_date,
      total: parseFloat(receipt.total),
      expenseAccountId: data.expenseAccountId,
      paymentAccountId: data.paymentAccountId,
      paymentAccountType: data.paymentAccountType,
      isPaid: receipt.is_paid || false,
      publishTarget: receipt.publish_target || 'Expense',
      description: receipt.description,
      imageUrl: receipt.image_url,
      paidBy: receipt.paid_by,
    }, req.organizationId);

    // Update receipt with QuickBooks transaction ID
    await sql`
      UPDATE receipts
      SET
        qb_transaction_id = ${result.transactionId},
        qb_account_id = ${data.expenseAccountId},
        status = 'published'
      WHERE id = ${data.receiptId}
    `;

    logAuditEvent({
      organizationId: req.organizationId,
      userId: req.userId,
      action: 'receipt.publish',
      resourceType: 'receipt',
      resourceId: data.receiptId,
      details: { vendorName: receipt.vendor_name, total: receipt.total, transactionId: result.transactionId, publishTarget: receipt.publish_target || 'Expense' },
      ipAddress: req.ip,
    });

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

