import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { syncCategories, getCachedCategories } from '../services/categorySyncService.js';

/**
 * GET /api/categories
 * Return cached QB categories for the authenticated user.
 */
export const getCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await getCachedCategories(req.userId!);

    const formatted = categories.map(cat => ({
      id: cat.qb_account_id,
      name: `${cat.qb_account_id} - ${cat.name}`,
      displayName: cat.name,
      type: cat.account_type,
      subType: cat.account_sub_type,
      lastSynced: cat.last_synced_at,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching cached categories:', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/categories/sync
 * Trigger a sync of QB categories from the QuickBooks API.
 */
export const syncCategoriesEndpoint = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await syncCategories(req.userId!);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error syncing categories:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';

    if (msg.includes('reconnect to QuickBooks') || msg.includes('No valid QuickBooks connection')) {
      return res.status(400).json({ error: 'QuickBooks not connected', details: msg });
    }

    res.status(500).json({ error: 'Failed to sync categories', details: msg });
  }
};
