import cron from 'node-cron';
import { 
  getStaleConnectionsForBackgroundRefresh, 
  refreshConnectionTokens 
} from '../services/qboAuthService.js';

/**
 * Background Job: Proactive QuickBooks Token Refresh
 * 
 * Option 3 (Hybrid Approach) - Background Component:
 * - Runs weekly on Sunday at 2:00 AM
 * - Only processes connections with refresh tokens 60+ days old
 * - Prevents tokens from expiring for inactive users
 * - Cost-effective: Only runs for truly inactive users (90% are handled by user activity)
 */

export function startQuickBooksTokenRefreshJob() {
  // Run every Sunday at 2:00 AM (low traffic time)
  // Cron format: minute hour day-of-month month day-of-week
  const schedule = '0 2 * * 0'; // Sunday 2 AM
  
  console.log('📅 QuickBooks token refresh job scheduled for Sundays at 2:00 AM');
  
  cron.schedule(schedule, async () => {
    console.log('🔄 Starting QuickBooks token refresh background job...');
    
    try {
      const staleConnections = await getStaleConnectionsForBackgroundRefresh();
      
      if (staleConnections.length === 0) {
        console.log('✓ No stale connections found. All tokens are fresh!');
        return;
      }
      
      console.log(`📊 Found ${staleConnections.length} stale connections to refresh`);
      
      let successCount = 0;
      let failCount = 0;
      
      // Process connections sequentially to avoid rate limiting
      for (const connection of staleConnections) {
        const refreshTokenAge = Math.floor(
          (Date.now() - new Date(connection.refresh_token_created_at).getTime()) / (24 * 60 * 60 * 1000)
        );
        
        console.log(`  Refreshing user ${connection.user_id} (token age: ${refreshTokenAge} days)...`);
        
        const success = await refreshConnectionTokens(connection);
        
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
        
        // Small delay between refreshes to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`✓ Background refresh complete: ${successCount} succeeded, ${failCount} failed`);
      
    } catch (error) {
      console.error('❌ Error in QuickBooks token refresh job:', error);
    }
  });
  
  // Optional: Run immediately on startup in development (for testing)
  if (process.env.NODE_ENV === 'development' && process.env.QB_REFRESH_JOB_ON_STARTUP === 'true') {
    console.log('🧪 Running token refresh job immediately for testing...');
    setTimeout(async () => {
      const staleConnections = await getStaleConnectionsForBackgroundRefresh();
      console.log(`Found ${staleConnections.length} stale connections in development mode`);
    }, 5000); // Wait 5 seconds after startup
  }
}

/**
 * Manual trigger for token refresh (useful for testing or admin tools)
 */
export async function manualTokenRefresh(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  console.log('🔧 Manual token refresh triggered...');
  
  const staleConnections = await getStaleConnectionsForBackgroundRefresh();
  
  let succeeded = 0;
  let failed = 0;
  
  for (const connection of staleConnections) {
    const success = await refreshConnectionTokens(connection);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return {
    processed: staleConnections.length,
    succeeded,
    failed,
  };
}

