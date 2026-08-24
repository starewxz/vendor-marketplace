import type { QueryClient } from '@tanstack/react-query';
import type { UserRole } from '../types/user';

type QueryInvalidator = Pick<QueryClient, 'invalidateQueries'>;

/**
 * Reconnection never attempts to replay missed socket messages. Active REST
 * read models are invalidated so TanStack Query refetches PostgreSQL-backed
 * authoritative state, then normal realtime delivery continues.
 */
export async function resyncAuthoritativeState(
  queryClient: QueryInvalidator,
  role?: UserRole,
): Promise<void> {
  const keys: unknown[][] = [
    ['catalog'],
    ['products'],
    ['auction'],
  ];
  if (role) keys.push(['orders']);
  if (role === 'SELLER') {
    keys.push(['seller-orders'], ['seller-auctions']);
  }
  if (role === 'ADMIN') {
    keys.push(['admin-orders'], ['admin-auctions']);
  }
  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
