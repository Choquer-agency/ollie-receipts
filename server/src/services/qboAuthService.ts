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
  realm_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: Date;
  refresh_token_created_at: Date;
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
 */
export function getAuthorizationUrl(): string {
  const oauthClient = createOAuthClient();
  const state = generateState(); // Generate random state for CSRF protection
  
  return oauthClient.authorizeUri({
    scope: QB_CONFIG.scopes,
    state,
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  tokens: TokenData;
  realmId: string;
}> {
  const oauthClient = createOAuthClient();
  
  try {
    const authResponse = await oauthClient.createToken(code);
    const token = authResponse.token;
    
    return {
      tokens: {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in || 3600,
        x_refresh_token_expires_in: token.x_refresh_token_expires_in || 8640000,
      },
      realmId: token.realmId,
    };
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw new Error('Failed to exchange authorization code for tokens');
  }
}

/**
 * Store QuickBooks connection in database
 */
export async function storeConnection(
  userId: string,
  realmId: string,
  tokens: TokenData,
  companyName?: string
): Promise<QBConnection> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const refreshTokenCreatedAt = new Date(); // Track when refresh token was created
  
  try {
    // Use INSERT ... ON CONFLICT to handle updates for existing connections
    const result = await sql`
      INSERT INTO quickbooks_connections (
        user_id, realm_id, access_token, refresh_token, 
        token_expires_at, refresh_token_created_at, company_name
      )
      VALUES (
        ${userId}, ${realmId}, ${tokens.access_token}, 
        ${tokens.refresh_token}, ${expiresAt.toISOString()},
        ${refreshTokenCreatedAt.toISOString()}, ${companyName || null}
      )
      ON CONFLICT (user_id) 
      DO UPDATE SET
        realm_id = EXCLUDED.realm_id,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        refresh_token_created_at = EXCLUDED.refresh_token_created_at,
        company_name = EXCLUDED.company_name,
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
 * Get QuickBooks connection for a user
 */
export async function getConnection(userId: string): Promise<QBConnection | null> {
  try {
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
 * Refresh access token using refresh token
 * Also updates refresh_token_created_at to track refresh token age
 */
export async function refreshAccessToken(connection: QBConnection): Promise<QBConnection> {
  const oauthClient = createOAuthClient();
  
  try {
    // Set the current refresh token
    oauthClient.setToken({
      refresh_token: connection.refresh_token,
      realmId: connection.realm_id,
    });
    
    // Refresh the token
    const authResponse = await oauthClient.refresh();
    const token = authResponse.token;
    
    const newTokens: TokenData = {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_in: token.expires_in || 3600,
      x_refresh_token_expires_in: token.x_refresh_token_expires_in || 8640000,
    };
    
    // Update tokens in database
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
    const now = new Date();
    
    // QuickBooks returns a NEW refresh token on each refresh
    // So we update refresh_token_created_at to track the new refresh token's age
    const result = await sql`
      UPDATE quickbooks_connections
      SET 
        access_token = ${newTokens.access_token},
        refresh_token = ${newTokens.refresh_token},
        token_expires_at = ${expiresAt.toISOString()},
        refresh_token_created_at = ${now.toISOString()},
        last_refreshed_at = CURRENT_TIMESTAMP
      WHERE user_id = ${connection.user_id}
      RETURNING *
    `;
    
    console.log(`✓ Tokens refreshed for user ${connection.user_id} (refresh token renewed)`);
    
    return result[0] as QBConnection;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw new Error('Failed to refresh access token');
  }
}

/**
 * Get valid access token (refresh if needed)
 * Option 3: Also proactively renews refresh token after 30 days (on user activity)
 */
export async function getValidAccessToken(userId: string): Promise<{
  accessToken: string;
  realmId: string;
} | null> {
  let connection = await getConnection(userId);
  
  if (!connection) {
    return null;
  }
  
  // Check if we need to refresh (either access token expired OR refresh token is old)
  const needsAccess = needsTokenRefresh(connection);
  const needsRefreshRenewal = needsRefreshTokenRenewal(connection);
  
  if (needsAccess) {
    console.log('Access token needs refresh, refreshing...');
    connection = await refreshAccessToken(connection);
  } else if (needsRefreshRenewal) {
    // Proactive refresh token renewal (Option 3: Hybrid - user activity trigger)
    console.log(`Refresh token is ${Math.floor((Date.now() - new Date(connection.refresh_token_created_at).getTime()) / (24 * 60 * 60 * 1000))} days old, proactively renewing...`);
    connection = await refreshAccessToken(connection);
  }
  
  return {
    accessToken: connection.access_token,
    realmId: connection.realm_id,
  };
}

/**
 * Revoke tokens and delete connection
 */
export async function revokeConnection(userId: string): Promise<boolean> {
  const connection = await getConnection(userId);
  
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
 * Get stale connections for background refresh (Option 3: Background job part)
 * Returns connections where:
 * - Refresh token is 60+ days old
 * - Last refresh was more than 7 days ago (avoid too frequent background refreshes)
 * - Token hasn't expired yet (still salvageable)
 */
export async function getStaleConnectionsForBackgroundRefresh(): Promise<QBConnection[]> {
  try {
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - QB_CONFIG.refreshTokenBackgroundThreshold);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const result = await sql`
      SELECT * FROM quickbooks_connections
      WHERE refresh_token_created_at < ${sixtyDaysAgo.toISOString()}
      AND last_refreshed_at < ${sevenDaysAgo.toISOString()}
      AND token_expires_at > ${now.toISOString()}
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

