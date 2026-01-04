import { Router } from 'express';
import {
  getReceipts,
  getReceiptById,
  createReceipt,
  updateReceipt,
  deleteReceipt,
  getUploadUrl,
} from '../controllers/receiptController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Receipt CRUD operations
router.get('/', getReceipts);
router.get('/:id', getReceiptById);
router.post('/', createReceipt);
router.patch('/:id', updateReceipt);
router.delete('/:id', deleteReceipt);

// File upload
router.get('/upload/url', getUploadUrl);

export default router;

