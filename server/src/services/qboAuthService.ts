import OAuthClient from 'intuit-oauth';
import { sql } from '../db/index.js';
import { QB_CONFIG } from '../config/quickbooks.js';

// Initialize OAuth client
export function createOAuthClient(): OAuthClient {
  return new OAuthClient({
    clientId: QB_CONFIG.clientId,
    clientSecret: QB_CONFIG.clientSecret,
    environment: QB_CONFIG.environment as 'sandbox' | 'production',
    redirectUri: QB_CONFIG.redirectUri,
  });
}

export interface QBConnection {
  id: string;
  user_id: string;
  organization_id: string | null;
  realm_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: Date;
  refresh_token_created_at: Date;
  refresh_token_expires_at: Date | null;
  company_name: string | null;
  connected_at: Date;
  last_refreshed_at: Date;
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  x_refresh_token_expires_in: number; // seconds
}

/**
 * Generate OAuth authorization URL
 * @param userId - Internal user ID to encode in state parameter
 */
export function getAuthorizationUrl(userId?: string): string {
  // Validate config before creating OAuth client
  if (!QB_CONFIG.clientId || !QB_CONFIG.clientSecret) {
    console.error('❌ QuickBooks OAuth config is incomplete!');
    console.error('Client ID:', QB_CONFIG.clientId ? '✓ Set' : '❌ MISSING');
    console.error('Client Secret:', QB_CONFIG.clientSecret ? '✓ Set' : '❌ MISSING');
    throw new Error('QuickBooks OAuth credentials are not configured');
  }
  
  console.log('✓ Generating OAuth URL with Client ID:', QB_CONFIG.clientId.substring(0, 10) + '...');
  
  const oauthClient = createOAuthClient();
  
  // Encode user ID in state for secure callback handling
  const state = userId ? `${generateState()}_uid_${userId}` : generateState();
  
  const authUrl = oauthClient.authorizeUri({
    scope: QB_CONFIG.scopes,
    state,
  });
  
  console.log('✓ OAuth URL generated:', authUrl.substring(0, 100) + '...');
  console.log('✓ State includes user ID:', !!userId);
  
  return authUrl;
}

/**
 * Extract user ID from OAuth state parameter
 */
export function extractUserIdFromState(state: string): string | null {
  const match = state.match(/_uid_(.+)$/);
  return match ? match[1] : null;
}

/**
 * Exchange authorization code for tokens
 * @param callbackUrl - The full callback URL received from QuickBooks with all query parameters
 */
export async function exchangeCodeForTokens(callbackUrl: string): Promise<{
  tokens: TokenData;
  realmId: string;
}> {
  const oauthClient = createOAuthClient();
  
  try {
    console.log('🔄 Exchanging authorization code for tokens...');
    console.log('📍 Callback URL:', callbackUrl.replace(/code=[^&]+/, 'code=REDACTED'));
    
    // Pass the full callback URL as received from QuickBooks
    // The intuit-oauth library will parse the code, realmId, and state from it
    const authResponse = await oauthClient.createToken(callbackUrl);
    const token = authResponse.token;
    
    console.log('✅ Token exchange successful');
    console.log('📊 Token details:', {
      hasAccessToken: !!token.access_token,
      hasRefreshToken: !!token.refresh_token,
      expiresIn: token.expires_in,
      realmId: token.realmId,
    });
    
    return {
      tokens: {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in || 3600,
        x_refresh_token_expires_in: token.x_refresh_token_expires_in || 8640000,
      },
      realmId: token.realmId,
    };
  } catch (error: any) {
    console.error('❌ Error exchanging code for tokens:', error);
    console.error('Error details:', error.message || 'Unknown error');
    console.error('Error response:', error.response?.data || 'No response data');
    throw new Error(`Failed to exchange authorization code for tokens: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Store QuickBooks connection in database
 */
export async function storeConnection(
  userId: string,
  realmId: string,
  tokens: TokenData,
  companyName?: string,
  organizationId?: string
): Promise<QBConnection> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const refreshTokenCreatedAt = new Date();
  const refreshTokenExpiresAt = new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000);

  try {
    // Use INSERT ... ON CONFLICT to handle updates for existing connections
    const result = await sql`
      INSERT INTO quickbooks_connections (
        user_id, realm_id, access_token, refresh_token,
        token_expires_at, refresh_token_created_at, refresh_token_expires_at,
        company_name, organization_id
      )
      VALUES (
        ${userId}, ${realmId}, ${tokens.access_token},
        ${tokens.refresh_token}, ${expiresAt.toISOString()},
        ${refreshTokenCreatedAt.toISOString()},
        ${refreshTokenExpiresAt.toISOString()},
        ${companyName || null}, ${organizationId || null}
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        realm_id = EXCLUDED.realm_id,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        refresh_token_created_at = EXCLUDED.refresh_token_created_at,
        refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
        company_name = EXCLUDED.company_name,
        organization_id = COALESCE(EXCLUDED.organization_id, quickbooks_connections.organization_id),
        last_refreshed_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    return result[0] as QBConnection;
  } catch (error) {
    console.error('Error storing QB connection:', error);
    throw new Error('Failed to store QuickBooks connection');
  }
}

/**
 * Get QuickBooks connection for a user (or their org)
 */
export async function getConnection(userId: string, organizationId?: string): Promise<QBConnection | null> {
  try {
    // Try org-level connection first
    if (organizationId) {
      const orgResult = await sql`
        SELECT * FROM quickbooks_connections
        WHERE organization_id = ${organizationId}
        LIMIT 1
      `;
      if (orgResult.length > 0) {
        return orgResult[0] as QBConnection;
      }
    }

    // Fallback to user-level connection
    const result = await sql`
      SELECT * FROM quickbooks_connections
      WHERE user_id = ${userId}
    `;

    return result.length > 0 ? (result[0] as QBConnection) : null;
  } catch (error) {
    console.error('Error getting QB connection:', error);
    return null;
  }
}

/**
 * Check if refresh token needs proactive renewal (Option 3: Hybrid approach)
 * Renew if refresh token is older than 30 days (user activity triggers)
 */
export function needsRefreshTokenRenewal(connection: QBConnection): boolean {
  const now = Date.now();
  const refreshTokenAge = now - new Date(connection.refresh_token_created_at).getTime();
  
  return refreshTokenAge >= QB_CONFIG.refreshTokenProactiveThreshold;
}

/**
 * Check if access token needs refresh (expired or expiring soon)
 */
export function needsTokenRefresh(connection: QBConnection): boolean {
  const now = Date.now();
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const bufferTime = QB_CONFIG.tokenRefreshBuffer;
  
  return expiresAt - now <= bufferTime;
}

/**
 * Classify a refresh error as fatal (must reconnect) or transient (can retry)
 */
function isTransientError(error: any): boolean {
  // Fatal: invalid_grant means refresh token is truly expired/revoked
  if (error.error === 'invalid_grant') return false;

  // Fatal: 401 from token endpoint means credentials are invalid
  const statusCode = error.response?.status || error.statusCode;
  if (statusCode === 401) return false;

  // Fatal: intuit-oauth library returns these messages when refresh token is dead
  const msg = (error.message || error.error_description || '').toLowerCase();
  if (msg.includes('refresh token is invalid') || msg.includes('please authorize again') || msg.includes('token expired')) return false;

  // Transient: rate limiting, server errors, network issues
  if (statusCode === 429 || (statusCode >= 500 && statusCode <= 504)) return true;
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') return true;
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnreset')) return true;

  // Default: treat unknown errors as transient (don't kill connection for unknowns)
  return true;
}

/**
 * Refresh access token using refresh token with retry for transient errors.
 * Also updates refresh_token_created_at and refresh_token_expires_at.
 */
export async function refreshAccessToken(connection: QBConnection): Promise<QBConnection> {
  const maxAttempts = QB_CONFIG.refreshRetryAttempts;
  const baseDelay = QB_CONFIG.refreshRetryBaseDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const oauthClient = createOAuthClient();

    try {
      console.log(`🔄 Refreshing access token for user ${connection.user_id} (attempt ${attempt}/${maxAttempts})...`);

      oauthClient.setToken({
        refresh_token: connection.refresh_token,
        realmId: connection.realm_id,
      });

      const authResponse = await oauthClient.refresh();
      const token = authResponse.token;

      const newTokens: TokenData = {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in || 3600,
        x_refresh_token_expires_in: token.x_refresh_token_expires_in || 8640000,
      };

      const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      const now = new Date();
      const refreshTokenExpiresAt = new Date(Date.now() + newTokens.x_refresh_token_expires_in * 1000);

      const result = await sql`
        UPDATE quickbooks_connections
        SET
          access_token = ${newTokens.access_token},
          refresh_token = ${newTokens.refresh_token},
          token_expires_at = ${expiresAt.toISOString()},
          refresh_token_created_at = ${now.toISOString()},
          refresh_token_expires_at = ${refreshTokenExpiresAt.toISOString()},
          last_refreshed_at = CURRENT_TIMESTAMP
        WHERE user_id = ${connection.user_id}
        RETURNING *
      `;

      console.log(`✅ Tokens refreshed successfully for user ${connection.user_id} (access expires: ${expiresAt.toISOString()}, refresh expires: ${refreshTokenExpiresAt.toISOString()})`);

      return result[0] as QBConnection;
    } catch (error: any) {
      console.error(`❌ Error refreshing token for user ${connection.user_id} (attempt ${attempt}/${maxAttempts}):`, error.message || 'Unknown error');

      // Fatal errors: don't retry, throw immediately
      if (!isTransientError(error)) {
        console.error('❌ Fatal error — refresh token is invalid/expired. User must reconnect.');
        const fatalError = new Error('QuickBooks refresh token expired. Please reconnect to QuickBooks.');
        (fatalError as any).fatal = true;
        throw fatalError;
      }

      // Transient error: retry with backoff if attempts remain
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Transient error, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // All retries exhausted — throw but don't mark as fatal
        console.error(`❌ All ${maxAttempts} retry attempts exhausted for user ${connection.user_id}`);
        const transientError = new Error(`Failed to refresh access token after ${maxAttempts} attempts: ${error.message || 'Unknown error'}`);
        (transientError as any).fatal = false;
        throw transientError;
      }
    }
  }

  // TypeScript needs this (unreachable)
  throw new Error('Unexpected: refresh loop exited without return or throw');
}

/**
 * Get valid access token (refresh if needed).
 * Only returns null for fatal errors (invalid_grant) — transient errors are thrown
 * so callers can distinguish "must reconnect" from "temporary problem".
 */
export async function getValidAccessToken(userId: string, organizationId?: string): Promise<{
  accessToken: string;
  realmId: string;
} | null> {
  let connection = await getConnection(userId, organizationId);

  if (!connection) {
    console.error(`❌ No QuickBooks connection found for user ${userId}`);
    return null;
  }

  const now = Date.now();
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const refreshTokenAge = now - new Date(connection.refresh_token_created_at).getTime();
  const refreshTokenAgeDays = Math.floor(refreshTokenAge / (24 * 60 * 60 * 1000));

  console.log(`📊 Token status for user ${userId}:`);
  console.log(`   - Access token expires: ${connection.token_expires_at}`);
  console.log(`   - Time until expiry: ${Math.floor((expiresAt - now) / 1000 / 60)} minutes`);
  console.log(`   - Refresh token age: ${refreshTokenAgeDays} days`);

  const needsAccess = needsTokenRefresh(connection);
  const needsRefreshRenewal = needsRefreshTokenRenewal(connection);

  if (needsAccess) {
    console.log('⚠️  Access token needs refresh, refreshing...');
    try {
      connection = await refreshAccessToken(connection);
    } catch (error: any) {
      if (error.fatal) {
        // Refresh token is truly dead — user must reconnect
        console.error('❌ Fatal: refresh token expired, user must reconnect');
        return null;
      }
      // Transient error — don't kill the connection, re-throw
      throw error;
    }
  } else if (needsRefreshRenewal) {
    console.log(`⚠️  Refresh token is ${refreshTokenAgeDays} days old, proactively renewing...`);
    try {
      connection = await refreshAccessToken(connection);
    } catch (error: any) {
      // Proactive renewal failed — not critical, access token is still valid
      console.warn('⚠️  Proactive refresh token renewal failed (non-fatal):', error.message);
    }
  } else {
    console.log('✅ Access token is valid, no refresh needed');
  }

  return {
    accessToken: connection.access_token,
    realmId: connection.realm_id,
  };
}

/**
 * Revoke tokens and delete connection
 */
export async function revokeConnection(userId: string, organizationId?: string): Promise<boolean> {
  const connection = await getConnection(userId, organizationId);
  
  if (!connection) {
    return false;
  }
  
  const oauthClient = createOAuthClient();
  
  try {
    // Revoke tokens with Intuit
    oauthClient.setToken({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      realmId: connection.realm_id,
    });
    
    await oauthClient.revoke();
  } catch (error) {
    console.error('Error revoking tokens with Intuit:', error);
    // Continue to delete from database even if revocation fails
  }
  
  try {
    // Delete from database
    await sql`
      DELETE FROM quickbooks_connections
      WHERE user_id = ${userId}
    `;
    
    return true;
  } catch (error) {
    console.error('Error deleting connection from database:', error);
    return false;
  }
}

/**
 * Generate random state for CSRF protection
 */
function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Check connection health by reading DB state — does NOT trigger a refresh.
 * Returns connected: true if the refresh token hasn't expired yet.
 * Used by the status endpoint to avoid the "check status → refresh fails → show reconnect" bug.
 */
export async function checkConnectionHealth(userId: string, organizationId?: string): Promise<{
  connected: boolean;
  companyName: string | null;
  connectedAt: Date | null;
  realmId: string | null;
  error?: string;
}> {
  const connection = await getConnection(userId, organizationId);

  if (!connection) {
    return { connected: false, companyName: null, connectedAt: null, realmId: null };
  }

  // Check if the refresh token has expired (the only thing that truly kills a connection)
  const now = Date.now();
  const refreshTokenExpiry = connection.refresh_token_expires_at
    ? new Date(connection.refresh_token_expires_at).getTime()
    : new Date(connection.refresh_token_created_at).getTime() + QB_CONFIG.refreshTokenLifetime;

  if (now > refreshTokenExpiry) {
    console.warn(`⚠ Refresh token expired for user ${userId} (expired at ${new Date(refreshTokenExpiry).toISOString()})`);
    return {
      connected: false,
      companyName: connection.company_name,
      connectedAt: connection.connected_at,
      realmId: connection.realm_id,
      error: 'refresh_token_expired',
    };
  }

  return {
    connected: true,
    companyName: connection.company_name,
    connectedAt: connection.connected_at,
    realmId: connection.realm_id,
  };
}

/**
 * Get stale connections for background refresh.
 * Returns connections where:
 * - Refresh token is 14+ days old (background threshold)
 * - Last refresh was more than 1 day ago (avoid over-refreshing)
 * - Refresh token hasn't expired yet (still salvageable)
 */
export async function getStaleConnectionsForBackgroundRefresh(): Promise<QBConnection[]> {
  try {
    const now = new Date();
    const backgroundThresholdAgo = new Date(now.getTime() - QB_CONFIG.refreshTokenBackgroundThreshold);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const result = await sql`
      SELECT * FROM quickbooks_connections
      WHERE refresh_token_created_at < ${backgroundThresholdAgo.toISOString()}
      AND last_refreshed_at < ${oneDayAgo.toISOString()}
      AND (
        refresh_token_expires_at > ${now.toISOString()}
        OR (refresh_token_expires_at IS NULL AND refresh_token_created_at > ${new Date(now.getTime() - QB_CONFIG.refreshTokenLifetime).toISOString()})
      )
      ORDER BY refresh_token_created_at ASC
      LIMIT 100
    `;

    return result as QBConnection[];
  } catch (error) {
    console.error('Error getting stale connections:', error);
    return [];
  }
}

/**
 * Refresh tokens for a specific connection (used by background job)
 */
export async function refreshConnectionTokens(connection: QBConnection): Promise<boolean> {
  try {
    await refreshAccessToken(connection);
    return true;
  } catch (error) {
    console.error(`Failed to refresh tokens for user ${connection.user_id}:`, error);
    return false;
  }
}

