import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/express';
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
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No authorization token provided');
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify the token with Clerk - using the sessions API
    try {
      // @ts-ignore - clerkClient types may not be perfect
      const session = await clerkClient.sessions.verifySession(token);
      
      if (!session || !session.userId) {
        console.log('Invalid session');
        return res.status(401).json({ error: 'Invalid token' });
      }

      req.clerkUserId = session.userId;
      console.log('Clerk user authenticated:', session.userId);

      // Get user info from Clerk to get email
      // @ts-ignore
      const clerkUser = await clerkClient.users.getUser(session.userId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress || session.userId;

      // Get or create user in our database
      const user = await getOrCreateUser(session.userId, email);
      req.userId = user.id;
      console.log('Database user ID:', user.id);

      next();
    } catch (verifyError) {
      console.error('Token verification error:', verifyError);
      return res.status(401).json({ error: 'Invalid or expired token' });
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

