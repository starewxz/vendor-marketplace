import { config as loadDotenv } from 'dotenv';
import { join } from 'path';

/**
 * Google OAuth must be optional in development (see README). We check raw
 * env vars here (not ConfigService) because this needs to be evaluated at
 * module-definition time, before Nest's DI container exists, to decide
 * whether GoogleStrategy is even registered as a provider.
 *
 * That timing matters: this file (via AuthModule) is imported — and this
 * function potentially called — *before* AppModule's own
 * `ConfigModule.forRoot()` call runs, since AppModule imports AuthModule
 * ahead of evaluating its own `@Module()` decorator. Without the explicit
 * dotenv load below, a real .env with real Google credentials would still
 * be invisible here: GoogleStrategy wouldn't be registered, so
 * `@UseGuards(AuthGuard('google'))` in AuthController would silently
 * receive an empty guards array (decorators are evaluated once, at that
 * same early import time) even though a later runtime check in the same
 * handler *would* see the now-loaded env and think everything is fine —
 * producing a bare 200 with an empty body instead of either a real
 * redirect or a clear "not configured" error. dotenv.config() only sets
 * variables that aren't already in process.env, so this is a no-op and
 * harmless wherever env vars are already present (Docker/CI inject them
 * directly; neither path below exists inside the built image).
 */
loadDotenv();
loadDotenv({ path: join(__dirname, '../../../../.env') });

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}
