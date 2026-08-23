import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchReindexModule } from './search-reindex.module';
import { Product } from '../modules/products/entities/product.entity';
import {
  SEARCH_INDEX_PORT,
  SearchIndexPort,
} from '../search/search-index.interface';
import {
  PRODUCTS_INDEX,
  PRODUCTS_INDEX_SETTINGS,
} from '../modules/products/search/catalog-search.constants';
import { buildProductSearchDocument } from '../modules/products/search/product-search-document';

const BATCH_SIZE = 500;

/**
 * `npm run search:reindex` — rebuilds the products index from Postgres
 * (the source of truth) from scratch. Idempotent: re-running just
 * re-upserts the same documents. Useful for a fresh environment, CI, or
 * recovering after search-sync was down for a while.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(SearchReindexModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const searchIndex = app.get<SearchIndexPort>(SEARCH_INDEX_PORT);
    const productsRepository = app.get<Repository<Product>>(
      getRepositoryToken(Product),
    );

    console.log(`Configuring index "${PRODUCTS_INDEX}" settings...`);
    await searchIndex.configureIndex(PRODUCTS_INDEX, PRODUCTS_INDEX_SETTINGS);

    const products = await productsRepository.find({
      where: { isPublished: true },
      relations: { sellerProfile: true, category: true },
    });
    console.log(`Found ${products.length} published product(s) to index.`);

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products
        .slice(i, i + BATCH_SIZE)
        .map(buildProductSearchDocument);
      await searchIndex.indexDocuments(PRODUCTS_INDEX, batch);
      console.log(
        `Indexed ${Math.min(i + BATCH_SIZE, products.length)}/${products.length}`,
      );
    }

    console.log('Reindex complete.');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Reindex failed:', error);
  process.exitCode = 1;
});
