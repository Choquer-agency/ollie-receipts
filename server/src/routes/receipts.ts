import { Router } from 'express';
import {
  getReceipts,
  getReceiptById,
  createReceipt,
  updateReceipt,
  deleteReceipt,
  getUploadUrl,
  checkDuplicates,
} from '../controllers/receiptController.js';
import { requireAuth, requireOrgRole } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Upload routes - all roles
router.get('/upload/url', getUploadUrl);
router.post('/check-duplicates', checkDuplicates);

// Read routes - all roles (controller handles employee filtering)
router.get('/', getReceipts);
router.get('/:id', getReceiptById);

// Create - all roles
router.post('/', createReceipt);

// Edit/Delete - admin + bookkeeper only
router.patch('/:id', requireOrgRole('org:admin', 'org:bookkeeper'), updateReceipt);
router.delete('/:id', requireOrgRole('org:admin', 'org:bookkeeper'), deleteReceipt);

export default router;
