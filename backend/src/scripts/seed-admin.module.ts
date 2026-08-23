import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../common/config/configuration';
import { validateEnv } from '../common/config/env.validation';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../modules/users/users.module';

/**
 * Deliberately narrow — only what's needed to upsert a User row. Reusing
 * the full AppModule here would also stand up Redis/BullMQ/Meilisearch
 * connections, which have no bearing on seeding an admin and would make
 * this script fail if those services aren't up yet.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    DatabaseModule,
    UsersModule,
  ],
})
export class SeedAdminModule {}
