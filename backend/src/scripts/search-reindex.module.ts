import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from '../common/config/configuration';
import { validateEnv } from '../common/config/env.validation';
import { DatabaseModule } from '../database/database.module';
import { SearchModule } from '../search/search.module';
import { Product } from '../modules/products/entities/product.entity';

/**
 * Narrow on purpose — reindexing only needs Postgres reads and the search
 * client, not Redis/BullMQ/HTTP. Mirrors seed-admin.module.ts.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    DatabaseModule,
    SearchModule,
    TypeOrmModule.forFeature([Product]),
  ],
})
export class SearchReindexModule {}
