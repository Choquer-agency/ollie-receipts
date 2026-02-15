import { sql } from '../db/index.js';

export interface CategoryRule {
  id: string;
  user_id: string;
  vendor_pattern: string;
  qb_category_id: string;
  match_type: 'exact' | 'contains';
  created_from_receipt_id: string | null;
  is_active: boolean;
  times_applied: number;
  created_at: string;
  updated_at: string;
  // Joined fields from qb_categories
  category_name?: string;
  qb_account_id?: string;
}

/**
 * Get all category rules for a user, joined with category names.
 */
export async function getRules(userId: string): Promise<CategoryRule[]> {
  const rows = await sql`
    SELECT cr.*, qc.name AS category_name, qc.qb_account_id
    FROM category_rules cr
    JOIN qb_categories qc ON cr.qb_category_id = qc.id
    WHERE cr.user_id = ${userId}
    ORDER BY cr.vendor_pattern ASC
  `;
  return rows as CategoryRule[];
}

/**
 * Resolve a QBO account ID (text) to the internal qb_categories UUID.
 */
async function resolveQbCategoryId(userId: string, qbAccountId: string): Promise<string> {
  const rows = await sql`
    SELECT id FROM qb_categories WHERE user_id = ${userId} AND qb_account_id = ${qbAccountId} AND active = true
  `;
  if (rows.length === 0) {
    throw new Error(`No active QB category found for account ID "${qbAccountId}"`);
  }
  return rows[0].id as string;
}

/**
 * Create a new category rule.
 */
export async function createRule(
  userId: string,
  data: {
    vendorPattern: string;
    qbCategoryId: string;
    matchType?: 'exact' | 'contains';
    receiptId?: string;
  }
): Promise<CategoryRule> {
  // Resolve QBO account ID to internal UUID
  const categoryUuid = await resolveQbCategoryId(userId, data.qbCategoryId);

  const rows = await sql`
    INSERT INTO category_rules (user_id, vendor_pattern, qb_category_id, match_type, created_from_receipt_id)
    VALUES (
      ${userId},
      ${data.vendorPattern},
      ${categoryUuid},
      ${data.matchType || 'exact'},
      ${data.receiptId || null}
    )
    ON CONFLICT (user_id, vendor_pattern, qb_category_id) DO UPDATE SET
      is_active = true,
      match_type = EXCLUDED.match_type,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  return rows[0] as CategoryRule;
}

/**
 * Update an existing rule (change category, toggle active, change match type).
 */
export async function updateRule(
  userId: string,
  ruleId: string,
  data: {
    qbCategoryId?: string;
    matchType?: 'exact' | 'contains';
    isActive?: boolean;
    vendorPattern?: string;
  }
): Promise<CategoryRule | null> {
  // Build SET clauses dynamically
  const sets: string[] = [];
  const values: any[] = [];

  // Resolve QBO account ID to internal UUID if provided
  let resolvedCategoryId: string | undefined;
  if (data.qbCategoryId !== undefined) {
    resolvedCategoryId = await resolveQbCategoryId(userId, data.qbCategoryId);
    sets.push('qb_category_id');
    values.push(resolvedCategoryId);
  }
  if (data.matchType !== undefined) {
    sets.push('match_type');
    values.push(data.matchType);
  }
  if (data.isActive !== undefined) {
    sets.push('is_active');
    values.push(data.isActive);
  }
  if (data.vendorPattern !== undefined) {
    sets.push('vendor_pattern');
    values.push(data.vendorPattern);
  }

  if (sets.length === 0) return null;

  // Use individual update queries since neon sql tagged template
  // doesn't support dynamic column names easily
  let result;
  if (resolvedCategoryId !== undefined) {
    result = await sql`
      UPDATE category_rules SET qb_category_id = ${resolvedCategoryId}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${ruleId} AND user_id = ${userId} RETURNING *
    `;
  }
  if (data.matchType !== undefined) {
    result = await sql`
      UPDATE category_rules SET match_type = ${data.matchType}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${ruleId} AND user_id = ${userId} RETURNING *
    `;
  }
  if (data.isActive !== undefined) {
    result = await sql`
      UPDATE category_rules SET is_active = ${data.isActive}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${ruleId} AND user_id = ${userId} RETURNING *
    `;
  }
  if (data.vendorPattern !== undefined) {
    result = await sql`
      UPDATE category_rules SET vendor_pattern = ${data.vendorPattern}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${ruleId} AND user_id = ${userId} RETURNING *
    `;
  }

  return result && result.length > 0 ? (result[0] as CategoryRule) : null;
}

/**
 * Delete a rule.
 */
export async function deleteRule(userId: string, ruleId: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM category_rules WHERE id = ${ruleId} AND user_id = ${userId} RETURNING id
  `;
  return result.length > 0;
}

/**
 * Find the best matching rule for a vendor name.
 * Priority: exact match first, then contains match.
 */
export async function matchRule(
  userId: string,
  vendorName: string
): Promise<CategoryRule | null> {
  // 1. Try exact match (case-insensitive)
  const exactMatch = await sql`
    SELECT cr.*, qc.name AS category_name, qc.qb_account_id
    FROM category_rules cr
    JOIN qb_categories qc ON cr.qb_category_id = qc.id
    WHERE cr.user_id = ${userId}
      AND cr.is_active = true
      AND cr.match_type = 'exact'
      AND LOWER(cr.vendor_pattern) = LOWER(${vendorName})
    LIMIT 1
  `;

  if (exactMatch.length > 0) {
    return exactMatch[0] as CategoryRule;
  }

  // 2. Try contains match (case-insensitive)
  const containsMatch = await sql`
    SELECT cr.*, qc.name AS category_name, qc.qb_account_id
    FROM category_rules cr
    JOIN qb_categories qc ON cr.qb_category_id = qc.id
    WHERE cr.user_id = ${userId}
      AND cr.is_active = true
      AND cr.match_type = 'contains'
      AND LOWER(${vendorName}) LIKE '%' || LOWER(cr.vendor_pattern) || '%'
    ORDER BY LENGTH(cr.vendor_pattern) DESC
    LIMIT 1
  `;

  if (containsMatch.length > 0) {
    return containsMatch[0] as CategoryRule;
  }

  return null;
}

/**
 * Increment the times_applied counter for a rule.
 */
export async function incrementRuleApplied(ruleId: string): Promise<void> {
  await sql`
    UPDATE category_rules SET times_applied = times_applied + 1 WHERE id = ${ruleId}
  `;
}
