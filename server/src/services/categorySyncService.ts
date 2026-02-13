import { sql } from '../db/index.js';
import { fetchExpenseAccounts, QBAccount } from './qboApiService.js';

export interface CachedCategory {
  id: string;
  user_id: string;
  qb_account_id: string;
  name: string;
  account_type: string;
  account_sub_type: string | null;
  active: boolean;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Sync expense categories from QuickBooks into the local cache.
 * - Upserts each QB account (insert or update on conflict)
 * - Deactivates categories that no longer exist in QB
 */
export async function syncCategories(userId: string): Promise<{
  synced: number;
  added: number;
  deactivated: number;
}> {
  const qbAccounts: QBAccount[] = await fetchExpenseAccounts(userId);

  const qbAccountIds: string[] = [];
  let added = 0;

  for (const account of qbAccounts) {
    qbAccountIds.push(account.Id);

    const result = await sql`
      INSERT INTO qb_categories (user_id, qb_account_id, name, account_type, account_sub_type, active, last_synced_at)
      VALUES (${userId}, ${account.Id}, ${account.Name}, ${account.AccountType}, ${account.AccountSubType || null}, true, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, qb_account_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        account_type = EXCLUDED.account_type,
        account_sub_type = EXCLUDED.account_sub_type,
        active = true,
        last_synced_at = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS is_insert
    `;
    if (result[0]?.is_insert) added++;
  }

  // Deactivate categories that are no longer in QB
  let deactivated = 0;
  if (qbAccountIds.length > 0) {
    const deactivateResult = await sql`
      UPDATE qb_categories
      SET active = false, last_synced_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
        AND active = true
        AND qb_account_id != ALL(${qbAccountIds})
    `;
    deactivated = Array.isArray(deactivateResult) ? deactivateResult.length : 0;
  }

  return { synced: qbAccounts.length, added, deactivated };
}

/**
 * Get all active cached categories for a user, ordered by name.
 */
export async function getCachedCategories(userId: string): Promise<CachedCategory[]> {
  const rows = await sql`
    SELECT * FROM qb_categories
    WHERE user_id = ${userId} AND active = true
    ORDER BY name ASC
  `;
  return rows as CachedCategory[];
}
