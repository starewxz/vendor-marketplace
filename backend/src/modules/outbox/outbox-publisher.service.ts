import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Interval } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';
import { OutboxStatus } from './entities/outbox-status.enum';
import { QUEUE_NAMES } from '../../queue/queue.constants';

const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 20;

/**
 * Polls PENDING outbox rows and relays each to BullMQ. `SKIP LOCKED` lets
 * multiple app instances poll concurrently without double-publishing the
 * same row (each locks and skips whatever another instance already has
 * locked); the `isPolling` flag guards against overlap within this single
 * process if a batch takes longer than the poll interval.
 *
 * A row is marked PUBLISHED only after the BullMQ `add()` call succeeds —
 * if Redis/BullMQ is briefly unavailable, the row stays PENDING and is
 * retried on the next tick. The domain transaction that wrote the row
 * already committed, so this failure never affects Postgres correctness.
 *
 * Routed by `event.aggregateType`: Product/Category go to SEARCH_SYNC,
 * SellerOrder goes to SELLER_ORDER_PROCESSING, Order and Refund go to
 * NOTIFICATIONS. NOTIFICATIONS has no consumer yet (full notification UI
 * is out of this stage's scope) — jobs simply accumulate there, which is
 * harmless and easy to wire a consumer onto later.
 */
@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private isPolling = false;
  private readonly queuesByAggregateType: Record<string, Queue>;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
    @InjectQueue(QUEUE_NAMES.SEARCH_SYNC)
    private readonly searchSyncQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SELLER_ORDER_PROCESSING)
    private readonly sellerOrderProcessingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
  ) {
    this.queuesByAggregateType = {
      Product: this.searchSyncQueue,
      Category: this.searchSyncQueue,
      SellerOrder: this.sellerOrderProcessingQueue,
      Order: this.notificationsQueue,
      Refund: this.notificationsQueue,
    };
  }

  @Interval(POLL_INTERVAL_MS)
  async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      await this.publishBatch();
    } catch (error) {
      this.logger.error(
        `outbox publish batch failed: ${(error as Error).message}`,
      );
    } finally {
      this.isPolling = false;
    }
  }

  private async publishBatch(): Promise<void> {
    await this.outboxRepository.manager.transaction(async (manager) => {
      const events = await manager
        .createQueryBuilder(OutboxEvent, 'event')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('event.status = :status', { status: OutboxStatus.PENDING })
        .orderBy('event.createdAt', 'ASC')
        .limit(BATCH_SIZE)
        .getMany();

      for (const event of events) {
        const queue = this.queuesByAggregateType[event.aggregateType];
        if (!queue) {
          event.attempts += 1;
          event.lastError = `No queue routed for aggregateType "${event.aggregateType}"`;
          await manager.save(event);
          this.logger.error(
            `[${event.correlationId}] outbox event has no route eventId=${event.id} aggregateType=${event.aggregateType}`,
          );
          continue;
        }
        try {
          await queue.add(
            event.eventType,
            {
              outboxEventId: event.id,
              eventType: event.eventType,
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              payload: event.payload,
              correlationId: event.correlationId,
            },
            {
              // Same id as the row itself — BullMQ treats a duplicate
              // add() with an existing jobId as a no-op, so a publisher
              // retrying a row it isn't sure got enqueued can't double-add.
              jobId: event.id,
              attempts: 5,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: 1000,
              removeOnFail: 1000,
            },
          );

          event.status = OutboxStatus.PUBLISHED;
          event.publishedAt = new Date();
          await manager.save(event);
          this.logger.log(
            `[${event.correlationId}] outbox event published eventId=${event.id} type=${event.eventType}`,
          );
        } catch (error) {
          event.attempts += 1;
          event.lastError = (error as Error).message;
          await manager.save(event);
          this.logger.warn(
            `[${event.correlationId}] outbox publish failed, will retry eventId=${event.id}: ${(error as Error).message}`,
          );
        }
      }
    });
  }
}
