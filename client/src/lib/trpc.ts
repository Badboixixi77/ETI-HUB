import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../../server/routers';

export const trpc = createTRPCReact<AppRouter>();

export function getBaseUrl() {
  return '/api/trpc';
}

export function trpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: getBaseUrl(),
        transformer: superjson,
        fetchOptions: {
          credentials: 'include' as RequestCredentials,
        },
      }),
    ],
  });
}

export type { AppRouter };
