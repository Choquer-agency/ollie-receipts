import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  matchRule,
  applyRuleToExistingReceipts,
} from '../services/currencyRulesService.js';

/**
 * GET /api/currency-rules
 */
export const listRules = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rules = await getRules(req.userId!);

    const formatted = rules.map(r => ({
      id: r.id,
      vendorPattern: r.vendor_pattern,
      currency: r.currency,
      matchType: r.match_type,
      isActive: r.is_active,
      timesApplied: r.times_applied,
      createdAt: r.created_at,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error listing currency rules:', error);
    res.status(500).json({ error: 'Failed to fetch currency rules' });
  }
};

/**
 * POST /api/currency-rules
 */
export const createRuleEndpoint = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { vendorPattern, currency, matchType, receiptId } = req.body;

    if (!vendorPattern) {
      return res.status(400).json({ error: 'vendorPattern is required' });
    }

    const rule = await createRule(req.userId!, {
      vendorPattern,
      currency,
      matchType,
      receiptId,
    });

    // Retroactively apply to existing receipts
    const appliedCount = await applyRuleToExistingReceipts(rule);

    res.status(201).json({
      id: rule.id,
      vendorPattern: rule.vendor_pattern,
      currency: rule.currency,
      matchType: rule.match_type,
      isActive: rule.is_active,
      timesApplied: rule.times_applied + appliedCount,
      appliedCount,
    });
  } catch (error) {
    console.error('Error creating currency rule:', error);
    res.status(500).json({ error: 'Failed to create currency rule' });
  }
};

/**
 * PATCH /api/currency-rules/:id
 */
export const updateRuleEndpoint = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { currency, matchType, isActive, vendorPattern } = req.body;

    const updated = await updateRule(req.userId!, id, {
      currency,
      matchType,
      isActive,
      vendorPattern,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // If currency changed, retroactively apply to existing receipts
    let appliedCount = 0;
    if (currency !== undefined) {
      appliedCount = await applyRuleToExistingReceipts(updated);
    }

    res.json({
      id: updated.id,
      vendorPattern: updated.vendor_pattern,
      currency: updated.currency,
      matchType: updated.match_type,
      isActive: updated.is_active,
      timesApplied: updated.times_applied + appliedCount,
      appliedCount,
    });
  } catch (error) {
    console.error('Error updating currency rule:', error);
    res.status(500).json({ error: 'Failed to update currency rule' });
  }
};

/**
 * DELETE /api/currency-rules/:id
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
    console.error('Error deleting currency rule:', error);
    res.status(500).json({ error: 'Failed to delete currency rule' });
  }
};

/**
 * POST /api/currency-rules/match
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
        currency: rule.currency,
        matchType: rule.match_type,
      },
    });
  } catch (error) {
    console.error('Error matching currency rule:', error);
    res.status(500).json({ error: 'Failed to match currency rule' });
  }
};
