import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { SellerProductsController } from './seller-products.controller';
import { MeilisearchCatalogSearchService } from './search/meilisearch-catalog-search.service';
import { PostgresCatalogFallbackService } from './search/postgres-catalog-fallback.service';
import { CATALOG_SEARCH_PORT } from './search/catalog-search.interface';
import { OutboxModule } from '../outbox/outbox.module';
import { SellersModule } from '../sellers/sellers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Category]),
    OutboxModule,
    SellersModule,
  ],
  controllers: [ProductsController, SellerProductsController],
  providers: [
    ProductsService,
    PostgresCatalogFallbackService,
    { provide: CATALOG_SEARCH_PORT, useClass: MeilisearchCatalogSearchService },
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
