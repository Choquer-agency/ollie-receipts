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
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7);
    
    // Verify the token with Clerk
    const decoded = await clerkClient.verifyToken(token);
    
    if (!decoded || !decoded.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.clerkUserId = decoded.sub;

    // Get or create user in our database
    const user = await getOrCreateUser(decoded.sub, decoded.email as string);
    req.userId = user.id;

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

async function getOrCreateUser(clerkUserId: string, email: string) {
  // Try to find existing user
  const existingUsers = await sql`
    SELECT * FROM users WHERE clerk_user_id = ${clerkUserId}
  `;

  if (existingUsers.length > 0) {
    return existingUsers[0];
  }

  // Create new user
  const newUsers = await sql`
    INSERT INTO users (clerk_user_id, email, name)
    VALUES (${clerkUserId}, ${email}, ${email.split('@')[0]})
    RETURNING *
  `;

  return newUsers[0];
}

