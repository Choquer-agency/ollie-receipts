import { QuickBooksAccount, PaymentAccount, Receipt } from "../types";
import api from "./apiService";

/**
 * Connect to QuickBooks via OAuth
 * Opens a popup window for OAuth authentication
 */
export const connectToQuickBooks = async (): Promise<boolean> => {
  try {
    // Get OAuth URL from backend
    const response = await api.get('/api/qbo/auth-url');
    const { authUrl } = response.data;
    
    // Open OAuth popup
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const popup = window.open(
      authUrl,
      'QuickBooks OAuth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );
    
    if (!popup) {
      throw new Error('Failed to open OAuth popup. Please allow popups for this site.');
    }
    
    // Listen for message from popup window
    return new Promise((resolve) => {
      const messageHandler = (event: MessageEvent) => {
        // Verify message is from our popup
        if (event.data && event.data.type) {
          if (event.data.type === 'qbo_connected' && event.data.success) {
            console.log('✅ QuickBooks connected!', event.data.companyName);
            window.removeEventListener('message', messageHandler);
            resolve(true);
          } else if (event.data.type === 'qbo_error') {
            console.error('❌ QuickBooks connection error:', event.data.error);
            window.removeEventListener('message', messageHandler);
            resolve(false);
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Also poll for popup closure as fallback
      const checkInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkInterval);
          window.removeEventListener('message', messageHandler);
          
          // Check connection status as fallback
          checkQBOStatus().then(status => {
            resolve(status.connected);
          }).catch(() => {
            resolve(false);
          });
        }
      }, 500);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('message', messageHandler);
        if (!popup.closed) {
          popup.close();
        }
        resolve(false);
      }, 5 * 60 * 1000);
    });
  } catch (error) {
    console.error('Error connecting to QuickBooks:', error);
    throw error;
  }
};

/**
 * Check QuickBooks connection status
 */
export const checkQBOStatus = async (): Promise<{
  connected: boolean;
  companyName?: string;
  connectedAt?: string;
}> => {
  try {
    const response = await api.get('/api/qbo/status');
    return response.data;
  } catch (error) {
    console.error('Error checking QBO status:', error);
    return { connected: false };
  }
};

/**
 * Disconnect from QuickBooks
 */
export const disconnectQBO = async (): Promise<boolean> => {
  try {
    await api.delete('/api/qbo/disconnect');
    return true;
  } catch (error) {
    console.error('Error disconnecting from QuickBooks:', error);
    return false;
  }
};

/**
 * Fetch expense accounts (Chart of Accounts)
 */
export const fetchAccounts = async (): Promise<QuickBooksAccount[]> => {
  try {
    const response = await api.get('/api/qbo/accounts');
    return response.data;
  } catch (error) {
    console.error('Error fetching accounts:', error);
    throw error;
  }
};

/**
 * Fetch payment accounts (Bank and Credit Card accounts)
 */
export const fetchPaymentAccounts = async (): Promise<PaymentAccount[]> => {
  try {
    const response = await api.get('/api/qbo/payment-accounts');
    return response.data;
  } catch (error) {
    console.error('Error fetching payment accounts:', error);
    throw error;
  }
};

/**
 * Publish receipt to QuickBooks
 */
export const publishReceipt = async (
  receipt: Receipt,
  accountId: string
): Promise<string> => {
  try {
    const response = await api.post('/api/qbo/publish', {
      receiptId: receipt.id,
      expenseAccountId: accountId,
      paymentAccountId: receipt.payment_account_id,
    });
    
    return response.data.transactionId;
  } catch (error) {
    console.error('Error publishing receipt:', error);
    throw error;
  }
};





