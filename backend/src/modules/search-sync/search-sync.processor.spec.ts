/* eslint-disable @typescript-eslint/no-unsafe-return -- jest.fn() mock typing */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { SearchSyncProcessor } from './search-sync.processor';
import type { SearchSyncJobData } from './search-sync.processor';
import { ProcessedEvent } from '../outbox/entities/processed-event.entity';
import { SEARCH_INDEX_PORT } from '../../search/search-index.interface';
import { ProductsService } from '../products/products.service';
import { PRODUCTS_INDEX } from '../products/search/catalog-search.constants';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';

function buildJob(data: SearchSyncJobData): Job<SearchSyncJobData> {
  return { data, attemptsMade: 0 } as unknown as Job<SearchSyncJobData>;
}

describe('SearchSyncProcessor', () => {
  let processor: SearchSyncProcessor;
  let processedEventsRepository: {
    exists: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let searchIndex: { indexDocument: jest.Mock; deleteDocument: jest.Mock };
  let productsService: {
    loadSearchDocument: jest.Mock;
    findManyByCategory: jest.Mock;
  };

  beforeEach(async () => {
    processedEventsRepository = {
      exists: jest.fn().mockResolvedValue(false),
      save: jest.fn(),
      create: jest.fn((x) => x),
    };
    searchIndex = { indexDocument: jest.fn(), deleteDocument: jest.fn() };
    productsService = {
      loadSearchDocument: jest.fn(),
      findManyByCategory: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchSyncProcessor,
        {
          provide: getRepositoryToken(ProcessedEvent),
          useValue: processedEventsRepository,
        },
        { provide: SEARCH_INDEX_PORT, useValue: searchIndex },
        { provide: ProductsService, useValue: productsService },
        MetricsRegistryService,
      ],
    }).compile();

    processor = moduleRef.get(SearchSyncProcessor);
  });

  it('skips a duplicate delivery of an already-processed event without re-syncing', async () => {
    processedEventsRepository.exists.mockResolvedValue(true);

    await processor.process(
      buildJob({
        outboxEventId: 'evt-1',
        eventType: 'PRODUCT_CREATED',
        aggregateType: 'Product',
        aggregateId: 'p1',
        correlationId: 'c1',
      }),
    );

    expect(productsService.loadSearchDocument).not.toHaveBeenCalled();
    expect(processedEventsRepository.save).not.toHaveBeenCalled();
  });

  it('upserts the current product state on PRODUCT_CREATED and marks the event processed', async () => {
    productsService.loadSearchDocument.mockResolvedValue({
      id: 'p1',
      name: 'Widget',
    });

    await processor.process(
      buildJob({
        outboxEventId: 'evt-1',
        eventType: 'PRODUCT_CREATED',
        aggregateType: 'Product',
        aggregateId: 'p1',
        correlationId: 'c1',
      }),
    );

    expect(searchIndex.indexDocument).toHaveBeenCalledWith(PRODUCTS_INDEX, {
      id: 'p1',
      name: 'Widget',
    });
    expect(processedEventsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        consumerName: 'search-sync',
        outboxEventId: 'evt-1',
      }),
    );
  });

  it('removes the document if the product was deleted or unpublished by the time the job runs', async () => {
    productsService.loadSearchDocument.mockResolvedValue(null);

    await processor.process(
      buildJob({
        outboxEventId: 'evt-1',
        eventType: 'PRODUCT_UPDATED',
        aggregateType: 'Product',
        aggregateId: 'p1',
        correlationId: 'c1',
      }),
    );

    expect(searchIndex.deleteDocument).toHaveBeenCalledWith(
      PRODUCTS_INDEX,
      'p1',
    );
  });

  it('deletes the document directly on PRODUCT_DELETED', async () => {
    await processor.process(
      buildJob({
        outboxEventId: 'evt-1',
        eventType: 'PRODUCT_DELETED',
        aggregateType: 'Product',
        aggregateId: 'p1',
        correlationId: 'c1',
      }),
    );
    expect(searchIndex.deleteDocument).toHaveBeenCalledWith(
      PRODUCTS_INDEX,
      'p1',
    );
  });

  it('resyncs every product in the category on CATEGORY_UPDATED', async () => {
    productsService.findManyByCategory.mockResolvedValue([
      { id: 'p1' },
      { id: 'p2' },
    ]);
    productsService.loadSearchDocument.mockResolvedValue({ id: 'p1' });

    await processor.process(
      buildJob({
        outboxEventId: 'evt-1',
        eventType: 'CATEGORY_UPDATED',
        aggregateType: 'Category',
        aggregateId: 'cat-1',
        correlationId: 'c1',
      }),
    );

    expect(productsService.loadSearchDocument).toHaveBeenCalledTimes(2);
  });

  it('rethrows sync failures so BullMQ retries, and does not mark the event processed', async () => {
    productsService.loadSearchDocument.mockRejectedValue(
      new Error('meilisearch unreachable'),
    );

    await expect(
      processor.process(
        buildJob({
          outboxEventId: 'evt-1',
          eventType: 'PRODUCT_CREATED',
          aggregateType: 'Product',
          aggregateId: 'p1',
          correlationId: 'c1',
        }),
      ),
    ).rejects.toThrow('meilisearch unreachable');

    expect(processedEventsRepository.save).not.toHaveBeenCalled();
  });
});
