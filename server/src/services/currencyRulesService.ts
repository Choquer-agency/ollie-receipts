import { sql } from '../db/index.js';

export interface CurrencyRule {
  id: string;
  user_id: string;
  vendor_pattern: string;
  currency: string;
  match_type: 'exact' | 'contains';
  created_from_receipt_id: string | null;
  is_active: boolean;
  times_applied: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get all currency rules for a user.
 */
export async function getRules(userId: string): Promise<CurrencyRule[]> {
  const rows = await sql`
    SELECT * FROM currency_rules
    WHERE user_id = ${userId}
    ORDER BY vendor_pattern ASC
  `;
  return rows as CurrencyRule[];
}

/**
 * Create a new currency rule.
 */
export async function createRule(
  userId: string,
  data: {
    vendorPattern: string;
    currency?: string;
    matchType?: 'exact' | 'contains';
    receiptId?: string;
  }
): Promise<CurrencyRule> {
  const rows = await sql`
    INSERT INTO currency_rules (user_id, vendor_pattern, currency, match_type, created_from_receipt_id)
    VALUES (
      ${userId},
      ${data.vendorPattern},
      ${data.currency || 'USD'},
      ${data.matchType || 'exact'},
      ${data.receiptId || null}
    )
    ON CONFLICT (user_id, vendor_pattern) DO UPDATE SET
      currency = EXCLUDED.currency,
      is_active = true,
      match_type = EXCLUDED.match_type,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  return rows[0] as CurrencyRule;
}

/**
 * Update an existing currency rule.
 */
export async function updateRule(
  userId: string,
  ruleId: string,
  data: {
    currency?: string;
    matchType?: 'exact' | 'contains';
    isActive?: boolean;
    vendorPattern?: string;
  }
): Promise<CurrencyRule | null> {
  let result;
  if (data.currency !== undefined) {
    result = await sql`
      UPDATE currency_rules SET currency = ${data.currency}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${ruleId} AND user_id = ${userId} RETURNING *
    `;
  }
  if (data.matchType !== undefined) {
    result = await sql`
      UPDATE currency_rules SET match_type = ${data.matchType}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${ruleId} AND user_id = ${userId} RETURNING *
    `;
  }
  if (data.isActive !== undefined) {
    result = await sql`
      UPDATE currency_rules SET is_active = ${data.isActive}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${ruleId} AND user_id = ${userId} RETURNING *
    `;
  }
  if (data.vendorPattern !== undefined) {
    result = await sql`
      UPDATE currency_rules SET vendor_pattern = ${data.vendorPattern}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${ruleId} AND user_id = ${userId} RETURNING *
    `;
  }

  return result && result.length > 0 ? (result[0] as CurrencyRule) : null;
}

/**
 * Delete a rule.
 */
export async function deleteRule(userId: string, ruleId: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM currency_rules WHERE id = ${ruleId} AND user_id = ${userId} RETURNING id
  `;
  return result.length > 0;
}

/**
 * Find the best matching currency rule for a vendor name.
 * Priority: exact match first, then contains match (longest pattern wins).
 */
export async function matchRule(
  userId: string,
  vendorName: string
): Promise<CurrencyRule | null> {
  // 1. Try exact match (case-insensitive)
  const exactMatch = await sql`
    SELECT * FROM currency_rules
    WHERE user_id = ${userId}
      AND is_active = true
      AND match_type = 'exact'
      AND LOWER(vendor_pattern) = LOWER(${vendorName})
    LIMIT 1
  `;

  if (exactMatch.length > 0) {
    return exactMatch[0] as CurrencyRule;
  }

  // 2. Try contains match (case-insensitive, longest pattern wins)
  const containsMatch = await sql`
    SELECT * FROM currency_rules
    WHERE user_id = ${userId}
      AND is_active = true
      AND match_type = 'contains'
      AND LOWER(${vendorName}) LIKE '%' || LOWER(vendor_pattern) || '%'
    ORDER BY LENGTH(vendor_pattern) DESC
    LIMIT 1
  `;

  if (containsMatch.length > 0) {
    return containsMatch[0] as CurrencyRule;
  }

  return null;
}

/**
 * Increment the times_applied counter for a rule.
 */
export async function incrementRuleApplied(ruleId: string): Promise<void> {
  await sql`
    UPDATE currency_rules SET times_applied = times_applied + 1 WHERE id = ${ruleId}
  `;
}

/**
 * Apply a currency rule retroactively to existing unpublished receipts
 * that match the vendor pattern and don't already have foreign_currency set.
 * Copies total → foreign_amount, sets foreign_currency, NULLs total.
 */
export async function applyRuleToExistingReceipts(rule: CurrencyRule): Promise<number> {
  let result;
  if (rule.match_type === 'exact') {
    result = await sql`
      UPDATE receipts
      SET foreign_amount = total,
          foreign_currency = ${rule.currency},
          total = NULL,
          auto_currency_rule_id = ${rule.id},
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${rule.user_id}
        AND LOWER(vendor_name) = LOWER(${rule.vendor_pattern})
        AND status != 'published'
        AND foreign_currency IS NULL
        AND total IS NOT NULL
    `;
  } else {
    result = await sql`
      UPDATE receipts
      SET foreign_amount = total,
          foreign_currency = ${rule.currency},
          total = NULL,
          auto_currency_rule_id = ${rule.id},
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${rule.user_id}
        AND LOWER(vendor_name) LIKE '%' || LOWER(${rule.vendor_pattern}) || '%'
        AND status != 'published'
        AND foreign_currency IS NULL
        AND total IS NOT NULL
    `;
  }

  const count = (result as any).count ?? 0;

  if (count > 0) {
    await sql`
      UPDATE currency_rules SET times_applied = times_applied + ${count} WHERE id = ${rule.id}
    `;
  }

  return count;
}
