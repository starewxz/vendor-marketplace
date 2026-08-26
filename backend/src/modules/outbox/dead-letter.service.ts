import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { DeadLetterEvent } from './entities/dead-letter-event.entity';
import { DeadLetterStatus } from './entities/dead-letter-status.enum';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { isUniqueViolation } from '../../common/utils/slug';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';

export interface RecordDeadLetterInput {
  originalQueue: string;
  jobId: string;
  outboxEventId: string | null;
  eventType: string;
  aggregateType: string | null;
  aggregateId: string | null;
  payload: Record<string, unknown>;
  attemptsMade: number;
  failureReason: string;
  correlationId: string;
}

const REPLAY_JOB_ID_PREFIX = 'dlq-replay-';

/**
 * Operational home for jobs/events that exhausted every BullMQ retry
 * attempt (see DeadLetterListenerService, which is what actually detects
 * exhaustion and calls `record`). Persisted in Postgres — not just left in
 * Redis's `failed` set, which `removeOnFail` eventually prunes and which
 * disappears entirely on a Redis restart — so a permanently failed job is
 * always observable (`list`) and recoverable (`replay`), never silently
 * lost. See `npm run dlq:list` / `npm run dlq:replay -- <id>`.
 */
@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);
  private readonly queuesByName: Record<string, Queue>;

  constructor(
    @InjectRepository(DeadLetterEvent)
    private readonly repo: Repository<DeadLetterEvent>,
    @InjectQueue(QUEUE_NAMES.SEARCH_SYNC)
    searchSyncQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SELLER_ORDER_PROCESSING)
    sellerOrderProcessingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    notificationsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REALTIME)
    realtimeQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AUCTION_FINALIZATION)
    auctionFinalizationQueue: Queue,
    private readonly metrics: MetricsRegistryService,
  ) {
    this.queuesByName = {
      [QUEUE_NAMES.SEARCH_SYNC]: searchSyncQueue,
      [QUEUE_NAMES.SELLER_ORDER_PROCESSING]: sellerOrderProcessingQueue,
      [QUEUE_NAMES.NOTIFICATIONS]: notificationsQueue,
      [QUEUE_NAMES.REALTIME]: realtimeQueue,
      [QUEUE_NAMES.AUCTION_FINALIZATION]: auctionFinalizationQueue,
    };
  }

  getQueue(name: string): Queue | undefined {
    return this.queuesByName[name];
  }

  /** Idempotent: a duplicate (originalQueue, jobId) is a harmless no-op. */
  async record(input: RecordDeadLetterInput): Promise<DeadLetterEvent | null> {
    try {
      const entry = await this.repo.save(
        this.repo.create({
          ...input,
          failedAt: new Date(),
          status: DeadLetterStatus.PENDING,
        }),
      );
      this.metrics.increment('queue_dead_letter_total');
      this.logger.error(
        `[${input.correlationId}] dead-letter created deadLetterId=${entry.id} queue=${input.originalQueue} jobId=${input.jobId} eventType=${input.eventType} attemptsMade=${input.attemptsMade} reason=${input.failureReason}`,
      );
      return entry;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return null;
    }
  }

  list(status?: DeadLetterStatus): Promise<DeadLetterEvent[]> {
    return this.repo.find({
      where: status ? { status } : {},
      order: { failedAt: 'DESC' },
    });
  }

  findById(id: string): Promise<DeadLetterEvent | null> {
    return this.repo.findOneBy({ id });
  }

  findReplayingByOutboxEventId(
    originalQueue: string,
    outboxEventId: string,
  ): Promise<DeadLetterEvent | null> {
    return this.repo.findOneBy({
      originalQueue,
      outboxEventId,
      status: DeadLetterStatus.REPLAYING,
    });
  }

  async markReplayFailed(id: string): Promise<void> {
    await this.repo.update({ id }, { status: DeadLetterStatus.REPLAY_FAILED });
    this.metrics.increment('queue_replay_failures_total');
  }

  async markReplayed(id: string): Promise<void> {
    await this.repo.update(
      { id },
      { status: DeadLetterStatus.REPLAYED, replayedAt: new Date() },
    );
  }

  /**
   * Re-enqueues the original job payload into its original queue. Does
   * NOT itself guarantee no duplicate business effect — that guarantee
   * comes from the same ProcessedEvent check every consumer already runs
   * before applying any effect (see search-sync/seller-order-processing/
   * notifications/realtime processors), so replaying an already-succeeded
   * event, or the same dead-letter twice, is safe by construction rather
   * than by BullMQ jobId tricks. Each replay gets its own unique jobId so
   * a second replay call is never rejected as a duplicate job.
   */
  async replay(id: string): Promise<DeadLetterEvent> {
    const entry = await this.repo.findOneBy({ id });
    if (!entry) {
      throw new NotFoundException(`Dead-letter entry ${id} not found`);
    }
    const queue = this.queuesByName[entry.originalQueue];
    if (!queue) {
      throw new NotFoundException(
        `No queue registered for "${entry.originalQueue}"`,
      );
    }

    await this.repo.update({ id }, { status: DeadLetterStatus.REPLAYING });
    this.metrics.increment('queue_replay_total');
    this.logger.log(
      `[${entry.correlationId}] dead-letter replay started deadLetterId=${id} queue=${entry.originalQueue} originalJobId=${entry.jobId}`,
    );

    await queue.add(entry.eventType, entry.payload, {
      jobId: `${REPLAY_JOB_ID_PREFIX}${id}-${Date.now()}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });

    return this.repo.findOneByOrFail({ id });
  }
}
