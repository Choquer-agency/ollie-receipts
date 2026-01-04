import { Request, Response, NextFunction } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { sql } from '../db/index.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  clerkUserId?: string;
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

      // Get or create user in our database
      const user = await getOrCreateUser(clerkUserId, email);
      req.userId = user.id;
      console.log('Database user ID:', user.id);

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

async function getOrCreateUser(clerkUserId: string, email: string) {
  console.log('getOrCreateUser called for:', clerkUserId, email);
  
  // Try to find existing user
  const existingUsers = await sql`
    SELECT * FROM users WHERE clerk_user_id = ${clerkUserId}
  `;

  if (existingUsers.length > 0) {
    console.log('Found existing user:', existingUsers[0].id);
    return existingUsers[0];
  }

  console.log('Creating new user for Clerk ID:', clerkUserId);
  
  // Create new user
  const newUsers = await sql`
    INSERT INTO users (clerk_user_id, email, name)
    VALUES (${clerkUserId}, ${email}, ${email.split('@')[0]})
    RETURNING *
  `;

  console.log('Created new user:', newUsers[0].id);
  return newUsers[0];
}

