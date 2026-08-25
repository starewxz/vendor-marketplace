import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { ProcessedEvent } from '../outbox/entities/processed-event.entity';
import { Order } from '../orders/entities/order.entity';
import { SellerOrder } from '../orders/entities/seller-order.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { Auction } from '../bidding/entities/auction.entity';
import { Product } from '../products/entities/product.entity';
import { SellerApplication } from '../sellers/entities/seller-application.entity';
import { SellerProfile } from '../sellers/entities/seller-profile.entity';
import { isUniqueViolation } from '../../common/utils/slug';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { recordQueueJob } from '../metrics/queue-metrics.util';
import { NotificationsService } from './notifications.service';

const CONSUMER_NAME = 'notifications';

export interface NotificationsJobData {
  outboxEventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId: string;
}

/**
 * Consumer side of the outbox flow for Order/Refund/Dispute/Auction/
 * SellerApplication events -> NOTIFICATIONS queue -> here. Resolves the
 * recipient(s) for each event type and delivers via NotificationsService
 * (currently a structured-log sink; swapping in email/push later only
 * touches that one class). Same at-least-once + ProcessedEvent dedup shape
 * as the other outbox consumers, so a redelivered event never double-sends.
 */
@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    @InjectRepository(ProcessedEvent)
    private readonly processedEventsRepository: Repository<ProcessedEvent>,
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(SellerOrder)
    private readonly sellerOrders: Repository<SellerOrder>,
    @InjectRepository(Dispute)
    private readonly disputes: Repository<Dispute>,
    @InjectRepository(Auction)
    private readonly auctions: Repository<Auction>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(SellerApplication)
    private readonly sellerApplications: Repository<SellerApplication>,
    @InjectRepository(SellerProfile)
    private readonly sellerProfiles: Repository<SellerProfile>,
    private readonly notifications: NotificationsService,
    private readonly metrics: MetricsRegistryService,
  ) {
    super();
  }

  async process(job: Job<NotificationsJobData>): Promise<void> {
    const {
      outboxEventId,
      eventType,
      aggregateType,
      aggregateId,
      correlationId,
    } = job.data;

    const alreadyProcessed = await this.processedEventsRepository.exists({
      where: { consumerName: CONSUMER_NAME, outboxEventId },
    });
    if (alreadyProcessed) {
      this.logger.log(
        `[${correlationId}] notification skipped (already processed) eventId=${outboxEventId}`,
      );
      return;
    }

    try {
      await recordQueueJob(this.metrics, async () => {
        await this.dispatch(job.data);
        await this.markProcessed(outboxEventId);
      });
      this.metrics.increment('notifications_sent_total');
      this.logger.log(
        `[${correlationId}] notification delivered eventId=${outboxEventId} type=${eventType} aggregate=${aggregateType}:${aggregateId}`,
      );
    } catch (error) {
      this.logger.error(
        `[${correlationId}] notification failed eventId=${outboxEventId} (attempt ${job.attemptsMade + 1}): ${(error as Error).message}`,
      );
      throw error; // rethrow so BullMQ applies the configured retry/backoff
    }
  }

  private async dispatch(data: NotificationsJobData): Promise<void> {
    switch (data.aggregateType) {
      case 'Order':
        await this.notifyOrder(data);
        return;
      case 'Refund':
        await this.notifyRefund(data);
        return;
      case 'Dispute':
        await this.notifyDispute(data);
        return;
      case 'Auction':
        await this.notifyAuction(data);
        return;
      case 'SellerApplication':
        await this.notifySellerApplication(data);
        return;
      default:
        this.logger.warn(
          `notifications received an unrecognized aggregate type: ${data.aggregateType}`,
        );
    }
  }

  private async notifyOrder(data: NotificationsJobData): Promise<void> {
    const buyerId = data.payload.buyerId as string | undefined;
    if (buyerId) {
      this.notifications.notify(
        buyerId,
        `Your order ${data.aggregateId} was ${data.eventType === 'ORDER_CREATED' ? 'placed' : 'updated'}.`,
      );
      return;
    }
    const order = await this.orders.findOne({
      where: { id: data.aggregateId },
    });
    if (order) {
      this.notifications.notify(
        order.buyerId,
        `Your order ${order.id} status changed to ${order.status}.`,
      );
    }
  }

  private async notifyRefund(data: NotificationsJobData): Promise<void> {
    const sellerOrderId = data.payload.sellerOrderId as string | undefined;
    if (!sellerOrderId) return;
    const sellerOrder = await this.sellerOrders.findOne({
      where: { id: sellerOrderId },
      relations: { order: true },
    });
    if (!sellerOrder) return;
    this.notifications.notify(
      sellerOrder.order.buyerId,
      `A refund was issued for order ${sellerOrder.orderId}.`,
    );
    const sellerUserId = await this.resolveSellerUserId(
      sellerOrder.sellerProfileId,
    );
    if (sellerUserId) {
      this.notifications.notify(
        sellerUserId,
        `A refund was issued on seller order ${sellerOrder.id}.`,
      );
    }
  }

  private async notifyDispute(data: NotificationsJobData): Promise<void> {
    const dispute = await this.disputes.findOne({
      where: { id: data.aggregateId },
    });
    if (!dispute) return;
    this.notifications.notify(
      dispute.customerId,
      `Your dispute on seller order ${dispute.sellerOrderId} is now ${dispute.status}.`,
    );
    const sellerUserId = await this.resolveSellerUserId(
      dispute.sellerProfileId,
    );
    if (sellerUserId) {
      this.notifications.notify(
        sellerUserId,
        `Dispute ${dispute.id} on your seller order ${dispute.sellerOrderId} is now ${dispute.status}.`,
      );
    }
  }

  private async resolveSellerUserId(
    sellerProfileId: string,
  ): Promise<string | null> {
    const profile = await this.sellerProfiles.findOne({
      where: { id: sellerProfileId },
    });
    return profile?.userId ?? null;
  }

  private async notifyAuction(data: NotificationsJobData): Promise<void> {
    const auction = await this.auctions.findOne({
      where: { id: data.aggregateId },
    });
    if (!auction) return;
    const product = await this.products.findOne({
      where: { id: auction.productId },
      relations: { sellerProfile: true },
    });
    if (product) {
      this.notifications.notify(
        product.sellerProfile.userId,
        `Your auction "${product.name}" is now ${auction.status}.`,
      );
    }
    if (
      (data.eventType === 'AUCTION_WON' ||
        data.eventType === 'AUCTION_PURCHASE_WINDOW_OPENED') &&
      auction.winnerId
    ) {
      this.notifications.notify(
        auction.winnerId,
        `You won auction ${auction.id} — complete checkout before the purchase window expires.`,
      );
    }
  }

  private async notifySellerApplication(
    data: NotificationsJobData,
  ): Promise<void> {
    const application = await this.sellerApplications.findOne({
      where: { id: data.aggregateId },
    });
    if (!application) return;
    this.notifications.notify(
      application.userId,
      `Your seller application is now ${application.status}.`,
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
    }
  }
}
