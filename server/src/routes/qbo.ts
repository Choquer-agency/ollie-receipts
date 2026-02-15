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
router.get('/auth-url', requireAuth, requireOrgRole('org:admin', 'org:accountant'), getAuthUrl);
router.get('/callback', handleCallback); // Uses Clerk middleware from server, not requireAuth
router.get('/status', requireAuth, getConnectionStatus);
router.delete('/disconnect', requireAuth, requireOrgRole('org:admin', 'org:accountant'), disconnect);

// API routes - admin + accountant + bookkeeper can access accounts and publish
router.get('/accounts', requireAuth, requireOrgRole('org:admin', 'org:accountant', 'org:bookkeeper'), getExpenseAccounts);
router.get('/payment-accounts', requireAuth, requireOrgRole('org:admin', 'org:accountant', 'org:bookkeeper'), getPaymentAccounts);
router.post('/publish', requireAuth, requireOrgRole('org:admin', 'org:accountant', 'org:bookkeeper'), publishReceipt);

export default router;
