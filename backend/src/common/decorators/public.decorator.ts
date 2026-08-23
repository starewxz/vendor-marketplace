import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as exempt from the global auth guard introduced in Stage 2.
 * Applied now to `health` so foundation checks don't require credentials.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
