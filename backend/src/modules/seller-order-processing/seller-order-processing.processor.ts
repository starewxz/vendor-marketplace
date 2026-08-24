import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { ProcessedEvent } from '../outbox/entities/processed-event.entity';
import { SellerOrder } from '../orders/entities/seller-order.entity';
import { SellerOrderStatus } from '../orders/entities/seller-order-status.enum';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { isUniqueViolation } from '../../common/utils/slug';

const CONSUMER_NAME = 'seller-order-processing';

export interface SellerOrderProcessingJobData {
  outboxEventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
}

/**
 * Consumer side of the outbox flow for SellerOrder events: OutboxEvent ->
 * BullMQ -> here.
 *
 * SELLER_ORDER_CREATED drives the initial AWAITING_FULFILLMENT ->
 * PROCESSING transition. SELLER_ORDER_STATUS_CHANGED/SELLER_ORDER_CANCELLED
 * (Stage 5) don't need this consumer to change any state — the seller/admin
 * endpoints that emit them already applied the transition synchronously,
 * inside the same DB transaction — so here they're an observability hook
 * only (structured log + metric), proving the same ProcessedEvent dedup
 * that protects the state-changing path also makes a duplicate delivery of
 * these a no-op rather than a double-counted metric.
 *
 * At-least-once + idempotent, same shape as SearchSyncProcessor: a
 * ProcessedEvent row short-circuits redelivery, and the
 * SELLER_ORDER_CREATED transition itself only ever moves forward from
 * AWAITING_FULFILLMENT, so replaying an already-applied event is a safe
 * no-op rather than a regression.
 */
@Processor(QUEUE_NAMES.SELLER_ORDER_PROCESSING)
export class SellerOrderProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(SellerOrderProcessingProcessor.name);

  constructor(
    @InjectRepository(ProcessedEvent)
    private readonly processedEventsRepository: Repository<ProcessedEvent>,
    @InjectRepository(SellerOrder)
    private readonly sellerOrdersRepository: Repository<SellerOrder>,
    private readonly metrics: MetricsRegistryService,
  ) {
    super();
  }

  async process(job: Job<SellerOrderProcessingJobData>): Promise<void> {
    const { outboxEventId, eventType, aggregateId, correlationId } = job.data;

    const alreadyProcessed = await this.processedEventsRepository.exists({
      where: { consumerName: CONSUMER_NAME, outboxEventId },
    });
    if (alreadyProcessed) {
      this.logger.log(
        `[${correlationId}] seller order processing skipped (already processed) eventId=${outboxEventId}`,
      );
      return;
    }

    this.logger.log(
      `[${correlationId}] seller order processing started eventId=${outboxEventId} type=${eventType}`,
    );
    try {
      await this.dispatch(eventType, aggregateId, correlationId);
      await this.markProcessed(outboxEventId);
      this.logger.log(
        `[${correlationId}] seller order processing completed eventId=${outboxEventId}`,
      );
    } catch (error) {
      this.logger.error(
        `[${correlationId}] seller order processing failed eventId=${outboxEventId} (attempt ${job.attemptsMade + 1}): ${(error as Error).message}`,
      );
      throw error; // rethrow so BullMQ applies the configured retry/backoff
    }
  }

  private async dispatch(
    eventType: string,
    aggregateId: string,
    correlationId: string,
  ): Promise<void> {
    switch (eventType) {
      case 'SELLER_ORDER_CREATED':
        await this.startProcessing(aggregateId, correlationId);
        return;
      case 'SELLER_ORDER_STATUS_CHANGED':
      case 'SELLER_ORDER_CANCELLED':
        // State already changed synchronously — see class doc comment.
        this.logger.log(
          `[${correlationId}] observed ${eventType} for sellerOrderId=${aggregateId}`,
        );
        return;
      default:
        this.logger.warn(
          `seller order processing received an unrecognized event type: ${eventType}`,
        );
    }
  }

  private async startProcessing(
    sellerOrderId: string,
    correlationId: string,
  ): Promise<void> {
    const sellerOrder = await this.sellerOrdersRepository.findOne({
      where: { id: sellerOrderId },
    });
    if (!sellerOrder) {
      // Redelivered after the order was somehow removed, or the event
      // arrived before the transaction that created it became visible to
      // this connection — either way there's nothing to transition.
      this.logger.warn(
        `[${correlationId}] seller order processing found no SellerOrder id=${sellerOrderId}, skipping`,
      );
      return;
    }
    if (sellerOrder.status !== SellerOrderStatus.AWAITING_FULFILLMENT) {
      this.logger.log(
        `[${correlationId}] seller order ${sellerOrderId} already past AWAITING_FULFILLMENT (status=${sellerOrder.status}), skipping`,
      );
      return;
    }

    sellerOrder.status = SellerOrderStatus.PROCESSING;
    await this.sellerOrdersRepository.save(sellerOrder);
    this.metrics.increment('seller_orders_processed_total');
    this.logger.log(
      `[${correlationId}] seller order ${sellerOrderId} transitioned to PROCESSING`,
    );
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
