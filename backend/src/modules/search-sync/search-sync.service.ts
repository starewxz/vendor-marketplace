import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SEARCH_INDEX_PORT } from '../../search/search-index.interface';
import type { SearchIndexPort } from '../../search/search-index.interface';

/**
 * Consumer side of the outbox flow: PostgreSQL -> OutboxEvent -> BullMQ ->
 * this service -> Meilisearch. The BullMQ processor that invokes this (and
 * the ProcessedEvent idempotency check) is added in the stage that
 * implements catalog sync end-to-end; this class only owns the translation
 * from a product change to a search document.
 */
@Injectable()
export class SearchSyncService {
  private readonly logger = new Logger(SearchSyncService.name);

  constructor(
    @Inject(SEARCH_INDEX_PORT) private readonly searchIndex: SearchIndexPort,
  ) {}

  async syncProduct(
    productId: string,
    document: Record<string, unknown>,
  ): Promise<void> {
    await this.searchIndex.indexDocument('products', {
      id: productId,
      ...document,
    });
    this.logger.debug(`Synced product ${productId} to search index`);
  }
}
