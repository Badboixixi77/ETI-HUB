import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { getUserFromToken } from './auth';
import type { Context } from './trpc';

export async function createContext({
  req,
  res,
}: CreateExpressContextOptions): Promise<Context> {
  const token = req?.cookies?.['eti_hub_session'];
  const user = await getUserFromToken(token);
  return { user, req, res };
}
