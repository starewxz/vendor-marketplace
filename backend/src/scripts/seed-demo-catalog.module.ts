import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from '../common/config/configuration';
import { validateEnv } from '../common/config/env.validation';
import { DatabaseModule } from '../database/database.module';
import { Product } from '../modules/products/entities/product.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { SellerProfile } from '../modules/sellers/entities/seller-profile.entity';
import { Auction } from '../modules/bidding/entities/auction.entity';
import { User } from '../modules/users/entities/user.entity';

/**
 * Deliberately narrow, same rationale as SeedAdminModule — only the
 * repositories seed-demo-catalog.ts needs, no Redis/BullMQ/Meilisearch.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([Product, Category, SellerProfile, Auction, User]),
  ],
})
export class SeedDemoCatalogModule {}
