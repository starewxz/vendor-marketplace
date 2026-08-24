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
 * SellerOrder goes to SELLER_ORDER_PROCESSING, and lifecycle aggregates go
 * to NOTIFICATIONS. State-bearing Product, SellerOrder, Order, Refund, and
 * Auction events are also fanned out to REALTIME. NOTIFICATIONS has no consumer yet (full notification UI
 * is out of this stage's scope) — jobs simply accumulate there, which is
 * harmless and easy to wire a consumer onto later. Auction's own state
 * transitions (BID_PLACED, AUCTION_WON, AUCTION_PURCHASED, ...) are never
 * driven by this queue — they're applied synchronously inside the same
 * transaction that writes the outbox row (see BidPlacementService /
 * AuctionLifecycleService / AuctionCheckoutService); routing them here only
 * makes them available to a future notification consumer.
 */
@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private isPolling = false;
  private readonly queuesByAggregateType: Record<string, Queue[]>;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
    @InjectQueue(QUEUE_NAMES.SEARCH_SYNC)
    private readonly searchSyncQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SELLER_ORDER_PROCESSING)
    private readonly sellerOrderProcessingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REALTIME)
    private readonly realtimeQueue: Queue,
  ) {
    this.queuesByAggregateType = {
      Product: [this.searchSyncQueue, this.realtimeQueue],
      Category: [this.searchSyncQueue],
      SellerOrder: [this.sellerOrderProcessingQueue, this.realtimeQueue],
      Order: [this.notificationsQueue, this.realtimeQueue],
      Refund: [this.notificationsQueue, this.realtimeQueue],
      Auction: [this.notificationsQueue, this.realtimeQueue],
      SellerApplication: [this.notificationsQueue],
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
        const queues = this.queuesByAggregateType[event.aggregateType];
        if (!queues) {
          event.attempts += 1;
          event.lastError = `No queue routed for aggregateType "${event.aggregateType}"`;
          await manager.save(event);
          this.logger.error(
            `[${event.correlationId}] outbox event has no route eventId=${event.id} aggregateType=${event.aggregateType}`,
          );
          continue;
        }
        try {
          await Promise.all(
            queues.map((queue) =>
              queue.add(
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
                  // The same id is safe across different queues, while a
                  // retry within one queue is deduplicated by BullMQ.
                  jobId: event.id,
                  attempts: 5,
                  backoff: { type: 'exponential', delay: 2000 },
                  removeOnComplete: 1000,
                  removeOnFail: 1000,
                },
              ),
            ),
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
