import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { SeedAdminModule } from './seed-admin.module';
import { UsersService } from '../modules/users/users.service';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * `npm run seed:admin` — explicit, developer-triggered sync of the
 * development admin account with the current ADMIN_EMAIL/ADMIN_PASSWORD/
 * ADMIN_NAME. Never run automatically on application startup.
 *
 * Idempotent regarding identity (never creates a second user for
 * ADMIN_EMAIL) but NOT a no-op on repeat runs: an existing account's role,
 * name, verification, and password are brought in line with the current
 * env every time this is run, so rotating ADMIN_PASSWORD in .env and
 * re-running this command is enough to change the admin's login password.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Admin';

  if (!email || !password) {
    console.error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed an admin.',
    );
    process.exitCode = 1;
    return;
  }

  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(' ') || 'Admin';

  const app = await NestFactory.createApplicationContext(SeedAdminModule, {
    logger: ['error', 'warn'],
  });
  const usersService = app.get(UsersService);

  try {
    // Only used to make the log line accurate about whether the password
    // itself changed — the actual write in syncSeedAdmin always applies
    // the freshly-hashed password regardless of this check.
    const existing = await usersService.findByEmailWithPassword(email);
    const passwordUnchanged =
      existing?.passwordHash != null &&
      (await bcrypt.compare(password, existing.passwordHash));

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const { user, created, profileChanged } = await usersService.syncSeedAdmin({
      email,
      passwordHash,
      firstName,
      lastName,
    });

    if (created) {
      console.log(`Admin created: ${user.email} (${user.id})`);
      return;
    }

    const changes: string[] = [];
    if (profileChanged) changes.push('role/name/verification synced');
    if (!passwordUnchanged)
      changes.push('password updated to match ADMIN_PASSWORD');

    console.log(
      changes.length > 0
        ? `Admin ${email}: ${changes.join(', ')}.`
        : `Admin already exists (${email}) — nothing to do.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Failed to seed admin:', error);
  process.exitCode = 1;
});
