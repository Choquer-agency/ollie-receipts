import { Request, Response, NextFunction } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { sql } from '../db/index.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  clerkUserId?: string;
  organizationId?: string;
  clerkOrgId?: string;
  orgRole?: string;
  auth?: {
    userId?: string;
    sessionId?: string;
    orgId?: string;
    orgRole?: string;
  };
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Use Clerk's getAuth to extract authenticated user info from the request
    const auth = getAuth(req);

    console.log('requireAuth - auth object:', JSON.stringify(auth));

    if (!auth || !auth.userId) {
      console.log('No authenticated user found - auth:', auth);
      console.log('Authorization header:', req.headers.authorization?.substring(0, 50));
      return res.status(401).json({ error: 'Unauthorized - No valid session' });
    }

    const clerkUserId = auth.userId;
    req.clerkUserId = clerkUserId;
    console.log('Clerk user authenticated:', clerkUserId);

    // Get user info from Clerk to get email
    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress || clerkUserId;
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email.split('@')[0];

      // Get or create user in our database
      const user = await getOrCreateUser(clerkUserId, email, name);
      req.userId = user.id;
      console.log('Database user ID:', user.id);

      // Handle organization context
      const clerkOrgId = (auth as any).orgId;
      const orgRole = (auth as any).orgRole;

      if (clerkOrgId) {
        req.clerkOrgId = clerkOrgId;
        req.orgRole = orgRole || 'org:employee';

        const org = await getOrCreateOrganization(clerkOrgId, user.id);
        req.organizationId = org.id;
        console.log('Organization context:', { orgId: org.id, role: req.orgRole });
      }

      next();
    } catch (userError) {
      console.error('Error fetching user from Clerk:', userError);
      return res.status(401).json({ error: 'Failed to authenticate user' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Authentication failed', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Middleware to require specific org roles.
 * If no org context, passes through (solo mode backward compat).
 */
export const requireOrgRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // No org context = solo mode, allow through
    if (!req.organizationId) {
      return next();
    }

    const role = req.orgRole || '';
    if (allowedRoles.includes(role)) {
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions for this action' });
  };
};

async function getOrCreateUser(clerkUserId: string, email: string, name?: string) {
  console.log('getOrCreateUser called for:', clerkUserId, email);

  // Try to find existing user
  const existingUsers = await sql`
    SELECT * FROM users WHERE clerk_user_id = ${clerkUserId}
  `;

  if (existingUsers.length > 0) {
    const user = existingUsers[0];
    // Update name if changed
    if (name && name !== user.name) {
      await sql`UPDATE users SET name = ${name} WHERE id = ${user.id}`;
      user.name = name;
    }
    console.log('Found existing user:', user.id);
    return user;
  }

  console.log('Creating new user for Clerk ID:', clerkUserId);

  // Create new user
  const newUsers = await sql`
    INSERT INTO users (clerk_user_id, email, name)
    VALUES (${clerkUserId}, ${email}, ${name || email.split('@')[0]})
    RETURNING *
  `;

  console.log('Created new user:', newUsers[0].id);
  return newUsers[0];
}

async function getOrCreateOrganization(clerkOrgId: string, creatingUserId: string) {
  // Try to find existing org
  const existingOrgs = await sql`
    SELECT * FROM organizations WHERE clerk_org_id = ${clerkOrgId}
  `;

  if (existingOrgs.length > 0) {
    return existingOrgs[0];
  }

  // Fetch org name from Clerk
  let orgName = 'Organization';
  try {
    const clerkOrg = await clerkClient.organizations.getOrganization({ organizationId: clerkOrgId });
    orgName = clerkOrg.name || orgName;
  } catch (e) {
    console.error('Error fetching org name from Clerk:', e);
  }

  // Create new org
  const newOrgs = await sql`
    INSERT INTO organizations (clerk_org_id, name, created_by)
    VALUES (${clerkOrgId}, ${orgName}, ${creatingUserId})
    RETURNING *
  `;

  const org = newOrgs[0];
  console.log('Created new organization:', org.id, orgName);

  // Auto-migrate: move user's existing receipts and QBO connection to this org
  await migrateUserDataToOrg(creatingUserId, org.id);

  return org;
}

async function migrateUserDataToOrg(userId: string, organizationId: string) {
  try {
    // Migrate receipts that don't already belong to an org
    const receiptResult = await sql`
      UPDATE receipts
      SET organization_id = ${organizationId},
          uploaded_by = COALESCE(uploaded_by, user_id)
      WHERE user_id = ${userId}
        AND organization_id IS NULL
    `;
    console.log(`Migrated receipts to org ${organizationId} for user ${userId}`);

    // Migrate QBO connection
    await sql`
      UPDATE quickbooks_connections
      SET organization_id = ${organizationId}
      WHERE user_id = ${userId}
        AND organization_id IS NULL
    `;
    console.log(`Migrated QBO connection to org ${organizationId} for user ${userId}`);
  } catch (error) {
    console.error('Error migrating user data to org (non-fatal):', error);
  }
}
