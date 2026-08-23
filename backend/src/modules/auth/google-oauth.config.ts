/**
 * Google OAuth must be optional in development (see README). We check raw
 * env vars here (not ConfigService) because this needs to be evaluated at
 * module-definition time, before Nest's DI container exists, to decide
 * whether GoogleStrategy is even registered as a provider.
 */
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}
