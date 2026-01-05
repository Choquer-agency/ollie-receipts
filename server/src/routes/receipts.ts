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
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Specific routes must come before parameterized routes
router.get('/upload/url', getUploadUrl);
router.post('/check-duplicates', checkDuplicates);

// Receipt CRUD operations
router.get('/', getReceipts);
router.get('/:id', getReceiptById);
router.post('/', createReceipt);
router.patch('/:id', updateReceipt);
router.delete('/:id', deleteReceipt);

export default router;

