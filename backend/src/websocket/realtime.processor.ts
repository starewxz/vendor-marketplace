import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import {
  formatCentsToMoney,
  parseMoneyToCents,
  sumCents,
} from '../common/utils/money';
import { isUniqueViolation } from '../common/utils/slug';
import { Auction } from '../modules/bidding/entities/auction.entity';
import { Bid } from '../modules/bidding/entities/bid.entity';
import { SellerOrder } from '../modules/orders/entities/seller-order.entity';
import { ProcessedEvent } from '../modules/outbox/entities/processed-event.entity';
import { Product } from '../modules/products/entities/product.entity';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { RealtimeService } from './realtime.service';
import {
  auctionRoom,
  orderRoom,
  productRoom,
  REALTIME_EVENTS,
  RealtimeJobData,
  sellerRoom,
  userRoom,
} from './realtime.types';

const CONSUMER_NAME = 'realtime';

const AUCTION_EVENT_NAMES: Record<string, string> = {
  BID_PLACED: REALTIME_EVENTS.AUCTION_BID_UPDATED,
  AUCTION_STARTED: REALTIME_EVENTS.AUCTION_STARTED,
  AUCTION_FINALIZED: REALTIME_EVENTS.AUCTION_FINALIZED,
  AUCTION_WON: REALTIME_EVENTS.AUCTION_WON,
  AUCTION_UNSOLD: REALTIME_EVENTS.AUCTION_UNSOLD,
  AUCTION_PURCHASE_WINDOW_OPENED:
    REALTIME_EVENTS.AUCTION_PURCHASE_WINDOW_OPENED,
  AUCTION_PURCHASED: REALTIME_EVENTS.AUCTION_PURCHASED,
  AUCTION_PURCHASE_WINDOW_EXPIRED:
    REALTIME_EVENTS.AUCTION_PURCHASE_WINDOW_EXPIRED,
};

@Processor(QUEUE_NAMES.REALTIME)
export class RealtimeProcessor extends WorkerHost {
  private readonly logger = new Logger(RealtimeProcessor.name);

  constructor(
    @InjectRepository(ProcessedEvent)
    private readonly processedEvents: Repository<ProcessedEvent>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Auction)
    private readonly auctions: Repository<Auction>,
    @InjectRepository(Bid)
    private readonly bids: Repository<Bid>,
    @InjectRepository(SellerOrder)
    private readonly sellerOrders: Repository<SellerOrder>,
    private readonly realtime: RealtimeService,
  ) {
    super();
  }

  async process(job: Job<RealtimeJobData>): Promise<void> {
    const event = job.data;
    if (
      await this.processedEvents.exists({
        where: {
          consumerName: CONSUMER_NAME,
          outboxEventId: event.outboxEventId,
        },
      })
    ) {
      return;
    }

    try {
      await this.dispatch(event);
      await this.markProcessed(event.outboxEventId);
    } catch (error) {
      this.logger.error(
        `[${event.correlationId}] realtime processing failed eventId=${event.outboxEventId} type=${event.eventType} attempt=${job.attemptsMade + 1}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async dispatch(event: RealtimeJobData): Promise<void> {
    if (
      event.aggregateType === 'Product' &&
      (event.eventType === 'STOCK_CHANGED' ||
        event.eventType === 'PRODUCT_UPDATED')
    ) {
      await this.emitProductStock(event);
      return;
    }
    if (
      event.aggregateType === 'Auction' &&
      AUCTION_EVENT_NAMES[event.eventType]
    ) {
      await this.emitAuction(event);
      return;
    }
    if (
      event.aggregateType === 'SellerOrder' &&
      [
        'SELLER_ORDER_CREATED',
        'SELLER_ORDER_STATUS_CHANGED',
        'SELLER_ORDER_CANCELLED',
      ].includes(event.eventType)
    ) {
      await this.emitOrderStatus(event);
    }
  }

  private async emitProductStock(event: RealtimeJobData): Promise<void> {
    const product = await this.products.findOne({
      where: { id: event.aggregateId },
    });
    if (!product) return;
    this.realtime.emitToRooms(
      [productRoom(product.id)],
      REALTIME_EVENTS.PRODUCT_STOCK_UPDATED,
      {
        productId: product.id,
        stock: product.stockQuantity,
        updatedAt: product.updatedAt.toISOString(),
      },
      { correlationId: event.correlationId, eventId: event.outboxEventId },
    );
  }

  private async emitAuction(event: RealtimeJobData): Promise<void> {
    const auction = await this.auctions.findOne({
      where: { id: event.aggregateId },
    });
    if (!auction) return;
    const bidCount = await this.bids.count({
      where: { auctionId: auction.id },
    });
    const minimumNextBid =
      bidCount === 0
        ? auction.startPrice
        : formatCentsToMoney(
            sumCents([
              parseMoneyToCents(auction.currentPrice),
              parseMoneyToCents(auction.minBidIncrement),
            ]),
          );
    this.realtime.emitToRooms(
      [auctionRoom(auction.id)],
      AUCTION_EVENT_NAMES[event.eventType],
      {
        auctionId: auction.id,
        status: auction.status,
        currentPrice: auction.currentPrice,
        bidCount,
        minimumNextBid,
        endsAt: auction.endsAt.toISOString(),
        purchaseWindowEndsAt:
          auction.purchaseWindowEndsAt?.toISOString() ?? null,
        updatedAt: auction.updatedAt.toISOString(),
      },
      { correlationId: event.correlationId, eventId: event.outboxEventId },
    );
  }

  private async emitOrderStatus(event: RealtimeJobData): Promise<void> {
    const sellerOrder = await this.sellerOrders.findOne({
      where: { id: event.aggregateId },
      relations: { order: true },
    });
    if (!sellerOrder) return;
    this.realtime.emitToRooms(
      [
        userRoom(sellerOrder.order.buyerId),
        sellerRoom(sellerOrder.sellerProfileId),
        orderRoom(sellerOrder.orderId),
      ],
      REALTIME_EVENTS.ORDER_STATUS_UPDATED,
      {
        orderId: sellerOrder.orderId,
        sellerOrderId: sellerOrder.id,
        sellerOrderStatus: sellerOrder.status,
        aggregateOrderStatus: sellerOrder.order.status,
        updatedAt: sellerOrder.updatedAt.toISOString(),
      },
      { correlationId: event.correlationId, eventId: event.outboxEventId },
    );
  }

  private async markProcessed(outboxEventId: string): Promise<void> {
    try {
      await this.processedEvents.save(
        this.processedEvents.create({
          consumerName: CONSUMER_NAME,
          outboxEventId,
        }),
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
}
