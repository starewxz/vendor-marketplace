import { Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { ProcessedEvent } from '../outbox/entities/processed-event.entity';
import { SEARCH_INDEX_PORT } from '../../search/search-index.interface';
import type { SearchIndexPort } from '../../search/search-index.interface';
import { PRODUCTS_INDEX } from '../products/search/catalog-search.constants';
import { ProductsService } from '../products/products.service';
import { isUniqueViolation } from '../../common/utils/slug';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { recordQueueJob } from '../metrics/queue-metrics.util';

const CONSUMER_NAME = 'search-sync';

export interface SearchSyncJobData {
  outboxEventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
}

/**
 * Consumer side of the outbox flow: OutboxEvent -> BullMQ -> here ->
 * Meilisearch. Always re-fetches the CURRENT product/category state from
 * Postgres rather than trusting the event payload as a data snapshot —
 * that makes handling self-healing against out-of-order redelivery (the
 * last processed event always reflects present truth, not a stale delta)
 * and keeps the payload itself tiny and not fragile to schema drift.
 *
 * At-least-once + idempotent: a ProcessedEvent row is only inserted after
 * a sync succeeds, and is checked first — but the sync operations
 * themselves (Meilisearch upsert-by-id, delete-if-exists) are also
 * naturally idempotent as a second line of defense.
 */
@Processor(QUEUE_NAMES.SEARCH_SYNC)
export class SearchSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchSyncProcessor.name);

  constructor(
    @InjectRepository(ProcessedEvent)
    private readonly processedEventsRepository: Repository<ProcessedEvent>,
    @Inject(SEARCH_INDEX_PORT) private readonly searchIndex: SearchIndexPort,
    private readonly productsService: ProductsService,
    private readonly metrics: MetricsRegistryService,
  ) {
    super();
  }

  async process(job: Job<SearchSyncJobData>): Promise<void> {
    const { outboxEventId, eventType, aggregateId, correlationId } = job.data;

    const alreadyProcessed = await this.processedEventsRepository.exists({
      where: { consumerName: CONSUMER_NAME, outboxEventId },
    });
    if (alreadyProcessed) {
      this.logger.log(
        `[${correlationId}] search sync skipped (already processed) eventId=${outboxEventId}`,
      );
      return;
    }

    this.logger.log(
      `[${correlationId}] search sync started eventId=${outboxEventId} type=${eventType}`,
    );
    try {
      await recordQueueJob(this.metrics, async () => {
        await this.dispatch(eventType, aggregateId);
        await this.markProcessed(outboxEventId);
      });
      this.logger.log(
        `[${correlationId}] search sync completed eventId=${outboxEventId}`,
      );
    } catch (error) {
      this.logger.error(
        `[${correlationId}] search sync failed eventId=${outboxEventId} (attempt ${job.attemptsMade + 1}): ${(error as Error).message}`,
      );
      throw error; // rethrow so BullMQ applies the configured retry/backoff
    }
  }

  private async dispatch(
    eventType: string,
    aggregateId: string,
  ): Promise<void> {
    switch (eventType) {
      case 'PRODUCT_CREATED':
      case 'PRODUCT_UPDATED':
      case 'STOCK_CHANGED':
        await this.syncProduct(aggregateId);
        return;
      case 'PRODUCT_DELETED':
        await this.searchIndex.deleteDocument(PRODUCTS_INDEX, aggregateId);
        return;
      case 'CATEGORY_UPDATED':
        await this.syncProductsForCategory(aggregateId);
        return;
      case 'CATEGORY_DELETED':
        // Categories can only be deleted once zero products reference them
        // (DB RESTRICT + a service-level pre-check) — nothing to reindex.
        return;
      default:
        this.logger.warn(
          `search sync received an unrecognized event type: ${eventType}`,
        );
    }
  }

  private async syncProduct(productId: string): Promise<void> {
    const document = await this.productsService.loadSearchDocument(productId);
    if (document) {
      await this.searchIndex.indexDocument(PRODUCTS_INDEX, document);
    } else {
      // Deleted, or unpublished since the event was enqueued — either way
      // it shouldn't be in the public index.
      await this.searchIndex.deleteDocument(PRODUCTS_INDEX, productId);
    }
  }

  private async syncProductsForCategory(categoryId: string): Promise<void> {
    const products = await this.productsService.findManyByCategory(categoryId);
    for (const product of products) {
      await this.syncProduct(product.id);
    }
  }

  private async markProcessed(outboxEventId: string): Promise<void> {
    try {
      await this.processedEventsRepository.save(
        this.processedEventsRepository.create({
          consumerName: CONSUMER_NAME,
          outboxEventId,
        }),
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Another worker already marked this event processed concurrently — fine.
    }
  }
}
