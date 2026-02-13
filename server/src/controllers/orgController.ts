import { Response } from 'express';
import { clerkClient } from '@clerk/express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sql } from '../db/index.js';

/**
 * Get organization info
 */
export const getOrgInfo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.organizationId || !req.clerkOrgId) {
      return res.status(400).json({ error: 'No organization context' });
    }

    const orgs = await sql`
      SELECT * FROM organizations WHERE id = ${req.organizationId}
    `;

    if (orgs.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get member count from Clerk
    let memberCount = 0;
    try {
      const members = await clerkClient.organizations.getOrganizationMembershipList({
        organizationId: req.clerkOrgId,
      });
      memberCount = members.totalCount ?? members.data?.length ?? 0;
    } catch (e) {
      console.error('Error fetching member count:', e);
    }

    res.json({
      id: orgs[0].id,
      name: orgs[0].name,
      role: req.orgRole,
      memberCount,
    });
  } catch (error) {
    console.error('Error getting org info:', error);
    res.status(500).json({ error: 'Failed to get organization info' });
  }
};

/**
 * Get organization members (for "paid by" dropdown)
 */
export const getOrgMembers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.clerkOrgId) {
      return res.status(400).json({ error: 'No organization context' });
    }

    const memberships = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: req.clerkOrgId,
    });

    const members = memberships.data.map((m: any) => ({
      id: m.publicUserData?.userId || '',
      name: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(' ')
        || m.publicUserData?.identifier
        || 'Unknown',
      email: m.publicUserData?.identifier || '',
      role: m.role,
      imageUrl: m.publicUserData?.imageUrl,
    }));

    res.json(members);
  } catch (error) {
    console.error('Error fetching org members:', error);
    res.status(500).json({ error: 'Failed to fetch organization members' });
  }
};

/**
 * Get audit log (admin only)
 */
export const getAuditLog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.organizationId) {
      return res.status(400).json({ error: 'No organization context' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const actionFilter = req.query.action as string;

    let entries;
    let countResult;

    if (actionFilter) {
      entries = await sql`
        SELECT al.*, u.name as user_name, u.email as user_email
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.organization_id = ${req.organizationId}
          AND al.action = ${actionFilter}
        ORDER BY al.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM audit_log
        WHERE organization_id = ${req.organizationId}
          AND action = ${actionFilter}
      `;
    } else {
      entries = await sql`
        SELECT al.*, u.name as user_name, u.email as user_email
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.organization_id = ${req.organizationId}
        ORDER BY al.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM audit_log
        WHERE organization_id = ${req.organizationId}
      `;
    }

    const total = parseInt(countResult[0].total);

    res.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
};
