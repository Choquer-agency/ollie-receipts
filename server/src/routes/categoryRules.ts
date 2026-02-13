import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listRules,
  createRuleEndpoint,
  updateRuleEndpoint,
  deleteRuleEndpoint,
  matchRuleEndpoint,
} from '../controllers/categoryRulesController.js';

const router = express.Router();

router.get('/', requireAuth, listRules);
router.post('/', requireAuth, createRuleEndpoint);
router.post('/match', requireAuth, matchRuleEndpoint);
router.patch('/:id', requireAuth, updateRuleEndpoint);
router.delete('/:id', requireAuth, deleteRuleEndpoint);

export default router;
