export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Deterministic collision handling: `wireless-headphones`,
 * `wireless-headphones-2`, `wireless-headphones-3`, ... This pre-check
 * narrows the odds of a race but isn't itself race-proof — callers must
 * still catch the unique-constraint violation on insert and retry (see
 * ProductsService/CategoriesService), since two concurrent requests can
 * both pass this check for the same candidate before either commits.
 */
export async function generateUniqueSlug(
  base: string,
  slugExists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const baseSlug = slugify(base) || 'item';
  let candidate = baseSlug;
  let suffix = 2;

  while (await slugExists(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

/** Postgres unique_violation error code. */
export const POSTGRES_UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === POSTGRES_UNIQUE_VIOLATION
  );
}
