import express from 'express';
import { requireAuth } from '../middleware/auth.js';
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
router.get('/auth-url', requireAuth, getAuthUrl);
router.get('/callback', handleCallback); // Uses Clerk middleware from server, not requireAuth
router.get('/status', requireAuth, getConnectionStatus);
router.delete('/disconnect', requireAuth, disconnect);

// API routes
router.get('/accounts', requireAuth, getExpenseAccounts);
router.get('/payment-accounts', requireAuth, getPaymentAccounts);
router.post('/publish', requireAuth, publishReceipt);

export default router;

