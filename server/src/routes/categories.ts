import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getCategories, syncCategoriesEndpoint } from '../controllers/categoryController.js';

const router = express.Router();

router.get('/', requireAuth, getCategories);
router.post('/sync', requireAuth, syncCategoriesEndpoint);

export default router;
