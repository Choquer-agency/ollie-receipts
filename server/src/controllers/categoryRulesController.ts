import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  matchRule,
  applyRuleToExistingReceipts,
} from '../services/categoryRulesService.js';

/**
 * GET /api/category-rules
 */
export const listRules = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rules = await getRules(req.userId!);

    const formatted = rules.map(r => ({
      id: r.id,
      vendorPattern: r.vendor_pattern,
      qbCategoryId: r.qb_category_id,
      categoryName: r.category_name,
      qbAccountId: r.qb_account_id,
      matchType: r.match_type,
      isActive: r.is_active,
      timesApplied: r.times_applied,
      createdAt: r.created_at,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error listing category rules:', error);
    res.status(500).json({ error: 'Failed to fetch category rules' });
  }
};

/**
 * POST /api/category-rules
 */
export const createRuleEndpoint = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { vendorPattern, qbCategoryId, matchType, receiptId } = req.body;

    if (!vendorPattern || !qbCategoryId) {
      return res.status(400).json({ error: 'vendorPattern and qbCategoryId are required' });
    }

    const rule = await createRule(req.userId!, {
      vendorPattern,
      qbCategoryId,
      matchType,
      receiptId,
    });

    // Retroactively apply to existing uncategorized receipts
    const appliedCount = await applyRuleToExistingReceipts(rule);

    res.status(201).json({
      id: rule.id,
      vendorPattern: rule.vendor_pattern,
      qbCategoryId: rule.qb_category_id,
      matchType: rule.match_type,
      isActive: rule.is_active,
      timesApplied: rule.times_applied + appliedCount,
      appliedCount,
    });
  } catch (error) {
    console.error('Error creating category rule:', error);
    res.status(500).json({ error: 'Failed to create category rule' });
  }
};

/**
 * PATCH /api/category-rules/:id
 */
export const updateRuleEndpoint = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { qbCategoryId, matchType, isActive, vendorPattern } = req.body;

    const updated = await updateRule(req.userId!, id, {
      qbCategoryId,
      matchType,
      isActive,
      vendorPattern,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // If category changed, retroactively apply to existing uncategorized receipts
    let appliedCount = 0;
    if (qbCategoryId !== undefined) {
      appliedCount = await applyRuleToExistingReceipts(updated);
    }

    res.json({
      id: updated.id,
      vendorPattern: updated.vendor_pattern,
      qbCategoryId: updated.qb_category_id,
      matchType: updated.match_type,
      isActive: updated.is_active,
      timesApplied: updated.times_applied + appliedCount,
      appliedCount,
    });
  } catch (error) {
    console.error('Error updating category rule:', error);
    res.status(500).json({ error: 'Failed to update category rule' });
  }
};

/**
 * DELETE /api/category-rules/:id
 */
export const deleteRuleEndpoint = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await deleteRule(req.userId!, id);

    if (!deleted) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category rule:', error);
    res.status(500).json({ error: 'Failed to delete category rule' });
  }
};

/**
 * POST /api/category-rules/match
 */
export const matchRuleEndpoint = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { vendorName } = req.body;

    if (!vendorName) {
      return res.status(400).json({ error: 'vendorName is required' });
    }

    const rule = await matchRule(req.userId!, vendorName);

    if (!rule) {
      return res.json({ match: null });
    }

    res.json({
      match: {
        ruleId: rule.id,
        vendorPattern: rule.vendor_pattern,
        qbCategoryId: rule.qb_category_id,
        categoryName: rule.category_name,
        qbAccountId: rule.qb_account_id,
        matchType: rule.match_type,
      },
    });
  } catch (error) {
    console.error('Error matching category rule:', error);
    res.status(500).json({ error: 'Failed to match category rule' });
  }
};
