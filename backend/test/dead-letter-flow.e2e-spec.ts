/* eslint-disable @typescript-eslint/no-unused-vars -- SearchIndexPort stub deliberately ignores most args */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { randomUUID } from 'crypto';
import type { Queue } from 'bullmq';
import type { Repository } from 'typeorm';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  SEARCH_INDEX_PORT,
  SearchIndexPort,
  SearchOptions,
  SearchResult,
  IndexSettings,
} from '../src/search/search-index.interface';
import { QUEUE_NAMES } from '../src/queue/queue.constants';
import { DeadLetterService } from '../src/modules/outbox/dead-letter.service';
import { DeadLetterEvent } from '../src/modules/outbox/entities/dead-letter-event.entity';
import { DeadLetterStatus } from '../src/modules/outbox/entities/dead-letter-status.enum';
import { ProcessedEvent } from '../src/modules/outbox/entities/processed-event.entity';
import { MetricsRegistryService } from '../src/modules/metrics/metrics-registry.service';

/**
 * Proves the dead-letter mechanism end to end against real BullMQ/Redis:
 * a genuinely failing search-sync job exhausts its (deliberately small,
 * test-only) retry budget, DeadLetterListenerService detects the terminal
 * failure via a real QueueEvents subscription, and DeadLetterService
 * records/replays it. Only the Meilisearch boundary (SEARCH_INDEX_PORT) is
 * swapped for a controllable stub — the queue, worker, retry/backoff, and
 * dead-letter persistence are all real, not mocked.
 *
 * Requires live Postgres/Redis/Meilisearch — see README "CI".
 */
describe('Dead-letter queue (e2e)', () => {
  let app: INestApplication<App>;
  let searchSyncQueue: Queue;
  let deadLetterService: DeadLetterService;
  let deadLetterRepository: Repository<DeadLetterEvent>;
  let processedEventsRepository: Repository<ProcessedEvent>;
  let metrics: MetricsRegistryService;

  let shouldFail = true;
  let deleteDocumentCalls = 0;
  let dlqEntry: DeadLetterEvent;
  const searchIndexStub: SearchIndexPort = {
    indexDocument: () => Promise.resolve(),
    indexDocuments: () => Promise.resolve(),
    deleteDocument: (_index: string, _id: string) => {
      deleteDocumentCalls += 1;
      if (shouldFail) {
        return Promise.reject(new Error('stubbed Meilisearch outage'));
      }
      return Promise.resolve();
    },
    search: <T extends Record<string, unknown>>(
      _index: string,
      _query: string,
      _options?: SearchOptions,
    ): Promise<SearchResult<T>> =>
      Promise.resolve({ hits: [], estimatedTotalHits: 0 }),
    configureIndex: (_index: string, _settings: IndexSettings) =>
      Promise.resolve(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SEARCH_INDEX_PORT)
      .useValue(searchIndexStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    searchSyncQueue = moduleFixture.get(getQueueToken(QUEUE_NAMES.SEARCH_SYNC));
    deadLetterService = moduleFixture.get(DeadLetterService);
    deadLetterRepository = moduleFixture.get(
      getRepositoryToken(DeadLetterEvent),
    );
    processedEventsRepository = moduleFixture.get(
      getRepositoryToken(ProcessedEvent),
    );
    metrics = moduleFixture.get(MetricsRegistryService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  async function waitFor<T>(
    fn: () => Promise<T | null>,
    timeoutMs = 15000,
    intervalMs = 200,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const result = await fn();
      if (result) return result;
      if (Date.now() > deadline) throw new Error('waitFor timed out');
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  it('(A) a job that exhausts its retries creates exactly one dead-letter entry', async () => {
    shouldFail = true;
    const outboxEventId = randomUUID();
    const aggregateId = randomUUID();
    const correlationId = randomUUID();
    const jobId = `dlq-test-${outboxEventId}`;

    await searchSyncQueue.add(
      'PRODUCT_DELETED',
      {
        outboxEventId,
        eventType: 'PRODUCT_DELETED',
        aggregateType: 'Product',
        aggregateId,
        correlationId,
      },
      {
        jobId,
        attempts: 2,
        backoff: { type: 'fixed', delay: 100 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );

    const entry = await waitFor(() =>
      deadLetterRepository.findOneBy({
        originalQueue: QUEUE_NAMES.SEARCH_SYNC,
        jobId,
      }),
    );
    dlqEntry = entry;

    expect(entry.outboxEventId).toBe(outboxEventId);
    expect(entry.eventType).toBe('PRODUCT_DELETED');
    expect(entry.attemptsMade).toBe(2);
    expect(entry.status).toBe(DeadLetterStatus.PENDING);
    expect(entry.failureReason).toContain('stubbed Meilisearch outage');
    expect(entry.correlationId).toBe(correlationId);

    // Not silently lost: it's listable.
    const listed = await deadLetterService.list(DeadLetterStatus.PENDING);
    expect(listed.some((e) => e.id === entry.id)).toBe(true);

    expect(metrics.renderPrometheusText()).toContain('queue_dead_letter_total');

    // Only ever the one row for this job, despite 2 attempts.
    const allForJob = await deadLetterRepository.find({
      where: { originalQueue: QUEUE_NAMES.SEARCH_SYNC, jobId },
    });
    expect(allForJob).toHaveLength(1);
  }, 20000);

  it('(B) replaying after the underlying failure is resolved processes successfully exactly once', async () => {
    const callsBefore = deleteDocumentCalls;

    shouldFail = false;
    await deadLetterService.replay(dlqEntry.id);

    const replayed = await waitFor(async () => {
      const current = await deadLetterRepository.findOneBy({ id: dlqEntry.id });
      return current?.status === DeadLetterStatus.REPLAYED ? current : null;
    });
    expect(replayed.replayedAt).not.toBeNull();

    const processed = await processedEventsRepository.findOneBy({
      consumerName: 'search-sync',
      outboxEventId: dlqEntry.outboxEventId!,
    });
    expect(processed).not.toBeNull();
    expect(deleteDocumentCalls).toBe(callsBefore + 1);
    expect(metrics.renderPrometheusText()).toContain('queue_replay_total');
  }, 20000);

  it('(C) replaying the same dead-letter a second time does not duplicate the business effect', async () => {
    const callsBefore = deleteDocumentCalls;

    await deadLetterService.replay(dlqEntry.id);

    // Give the (idempotent no-op) redelivery a moment to actually run.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const processedRows = await processedEventsRepository.find({
      where: {
        consumerName: 'search-sync',
        outboxEventId: dlqEntry.outboxEventId!,
      },
    });
    expect(processedRows).toHaveLength(1); // still exactly one — no duplicate
    // The processor's own ProcessedEvent check short-circuits before ever
    // calling the search index again, so the stub's call count doesn't move.
    expect(deleteDocumentCalls).toBe(callsBefore);
  }, 20000);
});
