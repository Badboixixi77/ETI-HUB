import bcrypt from 'bcrypt';
import { db, schema } from '../db';
import { eq, and, lt } from 'drizzle-orm';
import type { Role, SafeUser } from '../../shared/types';

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function randomToken(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken();
  await db.insert(schema.sessions).values({
    userId,
    token,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });
  return token;
}

export async function getUserFromToken(token: string | undefined): Promise<SafeUser | null> {
  if (!token) return null;

  const [session] = await db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.token, token)))
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  if (!user || !user.isActive) {
    return null;
  }

  // Touch lastActiveAt (fire-and-forget)
  db.update(schema.users)
    .set({ updatedAt: new Date() } as any)
    .where(eq(schema.users.id, session.userId))
    .execute()
    .catch(() => {});

  return toSafeUser(user);
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
}

// Clean up expired sessions (call periodically)
export async function pruneSessions(): Promise<void> {
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
}

export function toSafeUser(user: typeof schema.users.$inferSelect): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    title: user.title,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function hasRole(userRole: Role, allowedRoles: Role[]): boolean {
  if (userRole === 'admin') return true;
  return allowedRoles.includes(userRole);
}
