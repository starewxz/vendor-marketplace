const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parses simple durations like "15m" / "7d" (the format used by
 * JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN) into milliseconds.
 * Deliberately minimal — not a general-purpose duration parser.
 */
export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(
      `Invalid duration format: "${duration}" (expected e.g. "15m", "7d")`,
    );
  }
  const [, value, unit] = match;
  return Number(value) * UNIT_MS[unit];
}
