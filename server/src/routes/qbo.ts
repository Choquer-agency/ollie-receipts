import express from 'express';
import { requireAuth, requireOrgRole } from '../middleware/auth.js';
import {
  getAuthUrl,
  handleCallback,
  getConnectionStatus,
  disconnect,
  getExpenseAccounts,
  getPaymentAccounts,
  publishReceipt,
} from '../controllers/qboController.js';

const router = express.Router();

// OAuth routes
router.get('/auth-url', requireAuth, requireOrgRole('org:admin'), getAuthUrl);
router.get('/callback', handleCallback); // Uses Clerk middleware from server, not requireAuth
router.get('/status', requireAuth, getConnectionStatus);
router.delete('/disconnect', requireAuth, requireOrgRole('org:admin'), disconnect);

// API routes - admin + bookkeeper can access accounts and publish
router.get('/accounts', requireAuth, requireOrgRole('org:admin', 'org:bookkeeper'), getExpenseAccounts);
router.get('/payment-accounts', requireAuth, requireOrgRole('org:admin', 'org:bookkeeper'), getPaymentAccounts);
router.post('/publish', requireAuth, requireOrgRole('org:admin', 'org:bookkeeper'), publishReceipt);

export default router;
