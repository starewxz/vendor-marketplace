import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { SeedAdminModule } from './seed-admin.module';
import { UsersService } from '../modules/users/users.service';
import { UserRole } from '../modules/users/entities/user-role.enum';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * `npm run seed:admin` — idempotent: re-running with the same ADMIN_EMAIL
 * either does nothing (already an admin) or promotes an existing account,
 * it never creates a second user for that email.
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
    const existing = await usersService.findByEmail(email);

    if (existing) {
      if (existing.role === UserRole.ADMIN) {
        console.log(`Admin already exists (${email}) — nothing to do.`);
        return;
      }
      await usersService.setRole(existing.id, UserRole.ADMIN);
      console.log(`Existing user ${email} promoted to ADMIN.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const admin = await usersService.create({
      email,
      passwordHash,
      firstName,
      lastName,
      role: UserRole.ADMIN,
      isEmailVerified: true,
    });
    console.log(`Admin created: ${admin.email} (${admin.id})`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Failed to seed admin:', error);
  process.exitCode = 1;
});
