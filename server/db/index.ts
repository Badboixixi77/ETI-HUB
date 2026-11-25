import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
export { schema };

// ── Audit log helper ────────────────────────────────────────────────

export interface AuditLogParams {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  /** Legacy field — use targetType + targetId for new logs */
  target?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Insert an audit log entry. Never throws — failures are silently swallowed
 * so they never disrupt the main operation being audited.
 */
export async function insertAuditLog(params: AuditLogParams): Promise<void> {
  await db
    .insert(schema.auditLogs)
    .values({
      userId: params.userId ?? null,
      userEmail: params.userEmail ?? null,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      target: params.target ?? params.targetId ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    } as any)
    .catch(() => {});
}
