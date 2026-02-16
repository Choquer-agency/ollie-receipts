import cron from 'node-cron';
import {
  getStaleConnectionsForBackgroundRefresh,
  refreshConnectionTokens
} from '../services/qboAuthService.js';

/**
 * Background Job: Proactive QuickBooks Token Refresh
 *
 * Runs daily at 2:00 AM to keep refresh tokens alive for inactive users.
 * Processes connections with refresh tokens 14+ days old that haven't
 * been refreshed in the last 24 hours.
 */

export function startQuickBooksTokenRefreshJob() {
  // Run every day at 2:00 AM
  const schedule = '0 2 * * *';

  console.log('📅 QuickBooks token refresh job scheduled daily at 2:00 AM');

  cron.schedule(schedule, () => runTokenRefreshJob('scheduled'));

  // Optional: Run immediately on startup for testing
  if (process.env.QB_REFRESH_JOB_ON_STARTUP === 'true') {
    console.log('🧪 Running token refresh job immediately on startup...');
    setTimeout(() => runTokenRefreshJob('startup'), 5000);
  }
}

/**
 * Core refresh job logic — shared by scheduled runs, startup, and manual triggers.
 */
async function runTokenRefreshJob(trigger: 'scheduled' | 'startup' | 'manual'): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  console.log(`🔄 Starting QuickBooks token refresh job (trigger: ${trigger})...`);
  const errors: string[] = [];

  try {
    const staleConnections = await getStaleConnectionsForBackgroundRefresh();

    if (staleConnections.length === 0) {
      console.log('✓ No stale connections found. All tokens are fresh!');
      return { processed: 0, succeeded: 0, failed: 0, errors };
    }

    console.log(`📊 Found ${staleConnections.length} stale connection(s) to refresh`);

    let successCount = 0;
    let failCount = 0;

    for (const connection of staleConnections) {
      const refreshTokenAge = Math.floor(
        (Date.now() - new Date(connection.refresh_token_created_at).getTime()) / (24 * 60 * 60 * 1000)
      );

      console.log(`  Refreshing user ${connection.user_id} (token age: ${refreshTokenAge} days)...`);

      const success = await refreshConnectionTokens(connection);

      if (success) {
        successCount++;
        console.log(`  ✅ User ${connection.user_id} refreshed successfully`);
      } else {
        failCount++;
        const msg = `User ${connection.user_id} failed (token age: ${refreshTokenAge} days)`;
        errors.push(msg);
        console.error(`  ❌ ${msg}`);
      }

      // Delay between refreshes to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`✓ Background refresh complete: ${successCount} succeeded, ${failCount} failed out of ${staleConnections.length} total`);

    return { processed: staleConnections.length, succeeded: successCount, failed: failCount, errors };
  } catch (error) {
    console.error('❌ Error in QuickBooks token refresh job:', error);
    return { processed: 0, succeeded: 0, failed: 0, errors: [String(error)] };
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
  const result = await runTokenRefreshJob('manual');
  return {
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
  };
}
