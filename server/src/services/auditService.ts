import { sql } from '../db/index.js';

export type AuditAction =
  | 'receipt.upload'
  | 'receipt.update'
  | 'receipt.delete'
  | 'receipt.publish'
  | 'member.invite'
  | 'member.remove'
  | 'qbo.connect'
  | 'qbo.disconnect';

interface AuditEventParams {
  organizationId?: string;
  userId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Log an audit event. Non-fatal — won't block operations on failure.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  // Only log if there's an org context
  if (!params.organizationId) return;

  try {
    await sql`
      INSERT INTO audit_log (
        organization_id, user_id, action,
        resource_type, resource_id, details, ip_address
      )
      VALUES (
        ${params.organizationId},
        ${params.userId || null},
        ${params.action},
        ${params.resourceType || null},
        ${params.resourceId || null},
        ${params.details ? JSON.stringify(params.details) : null},
        ${params.ipAddress || null}
      )
    `;
  } catch (error) {
    console.error('Failed to log audit event (non-fatal):', error);
  }
}
