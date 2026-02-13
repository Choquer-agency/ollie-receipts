import { Router } from 'express';
import { requireAuth, requireOrgRole } from '../middleware/auth.js';
import { getOrgInfo, getOrgMembers, getAuditLog } from '../controllers/orgController.js';

const router = Router();

// All routes require auth
router.use(requireAuth);

// Org info - all members
router.get('/info', getOrgInfo);

// Members list - admin + bookkeeper (needed for "paid by" dropdown)
router.get('/members', requireOrgRole('org:admin', 'org:bookkeeper'), getOrgMembers);

// Audit log - admin only
router.get('/audit-log', requireOrgRole('org:admin'), getAuditLog);

export default router;
