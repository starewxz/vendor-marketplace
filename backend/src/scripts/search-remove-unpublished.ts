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
import { PRODUCTS_INDEX } from '../modules/products/search/catalog-search.constants';

/**
 * One-off cleanup: search-reindex.js only ever upserts currently-published
 * products, so a product that gets unpublished (rather than deleted) stays
 * in the Meilisearch index as a stale, unreachable-via-Postgres document.
 * This removes exactly the documents whose product row is now unpublished
 * — each one a single targeted deleteDocument call, not an index wipe.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(SearchReindexModule, {
    logger: ['error', 'warn'],
  });

  try {
    const searchIndex = app.get<SearchIndexPort>(SEARCH_INDEX_PORT);
    const productsRepository = app.get<Repository<Product>>(
      getRepositoryToken(Product),
    );

    const unpublished = await productsRepository.find({
      where: { isPublished: false },
      select: { id: true },
    });
    console.log(
      `Removing ${unpublished.length} unpublished document(s) from the "${PRODUCTS_INDEX}" index...`,
    );

    for (const product of unpublished) {
      await searchIndex.deleteDocument(PRODUCTS_INDEX, product.id);
    }

    console.log('Done.');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Failed to remove unpublished documents:', error);
  process.exitCode = 1;
});
