import dotenv from 'dotenv';

dotenv.config();

export const QB_CONFIG = {
  clientId: process.env.INTUIT_CLIENT_ID || '',
  clientSecret: process.env.INTUIT_CLIENT_SECRET || '',
  redirectUri: process.env.INTUIT_REDIRECT_URI || 'http://localhost:4000/api/qbo/callback',
  environment: process.env.INTUIT_ENVIRONMENT || 'sandbox', // 'sandbox' or 'production'
  
  // OAuth 2.0 scopes
  scopes: [
    'com.intuit.quickbooks.accounting', // Access to QuickBooks API
    'openid',
    'profile',
    'email',
  ],
  
  // QuickBooks API endpoints
  getApiUrl(): string {
    return this.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
  },
  
  // Token expiration settings
  tokenRefreshBuffer: 5 * 60 * 1000, // Refresh 5 minutes before expiry
  accessTokenLifetime: 60 * 60 * 1000, // 1 hour
  refreshTokenLifetime: 100 * 24 * 60 * 60 * 1000, // 100 days
  
  // Proactive refresh token renewal settings (Option 3: Hybrid approach)
  refreshTokenProactiveThreshold: 30 * 24 * 60 * 60 * 1000, // 30 days - refresh on user activity after this
  refreshTokenBackgroundThreshold: 60 * 24 * 60 * 60 * 1000, // 60 days - background job processes after this
};

// Validate required environment variables
export function validateQBConfig(): { valid: boolean; missing: string[] } {
  const required = ['INTUIT_CLIENT_ID', 'INTUIT_CLIENT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

