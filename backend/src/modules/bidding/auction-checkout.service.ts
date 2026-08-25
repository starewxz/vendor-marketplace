import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { AuctionStatus } from './entities/auction-status.enum';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order-status.enum';
import { SellerOrder } from '../orders/entities/seller-order.entity';
import { SellerOrderStatus } from '../orders/entities/seller-order-status.enum';
import { SellerOrderItem } from '../orders/entities/seller-order-item.entity';
import { CheckoutIdempotencyKey } from '../orders/entities/checkout-idempotency-key.entity';
import { CheckoutIdempotencyStatus } from '../orders/entities/checkout-idempotency-status.enum';
import { LedgerEntry } from '../payments-ledger/entities/ledger-entry.entity';
import { LedgerEntryType } from '../payments-ledger/entities/ledger-entry-type.enum';
import { assertValidAuctionTransition } from './domain/auction-status.policy';
import { AuctionCheckoutRequestDto } from './dto/auction-checkout-request.dto';
import { AuctionCheckoutResult } from './dto/auction-checkout-result';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { isUniqueViolation } from '../../common/utils/slug';
import {
  applyPercent,
  formatCentsToMoney,
  parseMoneyToCents,
} from '../../common/utils/money';

const IDEMPOTENCY_KEY_MAX_LENGTH = 200;

interface CheckoutOutcome {
  order: Order;
  sellerOrder: SellerOrder;
  productId: string;
}

/**
 * Winner-only purchase path, deliberately separate from CheckoutService
 * (which already rejects AUCTION products — see
 * checkout.service.spec.ts). Mirrors its structure closely — same
 * CheckoutIdempotencyKey insert-first claim, same guarded atomic stock
 * decrement, same Order/SellerOrder/SellerOrderItem/LedgerEntry/outbox
 * shape — but there is no cart: exactly one product, one seller, quantity
 * one, priced at the locked Auction's currentPrice (the winning bid),
 * never at Product.price. Reusing CheckoutService directly isn't possible
 * without a broader refactor (its transaction methods are private and
 * shaped around CartItem groups) — see README "Auction winner checkout"
 * for why this is an intentional, small amount of duplication rather than
 * a shared abstraction.
 */
@Injectable()
export class AuctionCheckoutService {
  private readonly logger = new Logger(AuctionCheckoutService.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
    private readonly outboxService: OutboxService,
    private readonly cache: CatalogCacheService,
    private readonly metrics: MetricsRegistryService,
  ) {}

  async checkout(
    winnerId: string,
    auctionId: string,
    idempotencyKey: string | undefined,
    correlationId: string,
    dto: AuctionCheckoutRequestDto,
  ): Promise<AuctionCheckoutResult> {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new BadRequestException('Idempotency-Key header is too long');
    }

    this.metrics.increment('auction_checkout_attempts_total');

    try {
      const outcome = await this.auctionsRepository.manager.transaction(
        (manager) =>
          this.runCheckoutTransaction(
            manager,
            winnerId,
            auctionId,
            idempotencyKey,
            correlationId,
            dto,
          ),
      );

      await this.cache.invalidateProduct(outcome.productId);
      await this.cache.invalidateSearch();

      this.metrics.increment('auction_checkout_succeeded_total');
      this.metrics.increment('orders_created_total');
      this.logger.log(
        `[${correlationId}] auction checkout completed auctionId=${auctionId} orderId=${outcome.order.id}`,
      );
      return this.toResult(outcome.order, outcome.sellerOrder, false);
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.log(
          `[${correlationId}] auction checkout idempotent replay auctionId=${auctionId} winnerId=${winnerId}`,
        );
        this.metrics.increment('auction_checkout_idempotent_replays_total');
        return this.replayCompletedCheckout(winnerId, idempotencyKey);
      }
      this.metrics.increment('auction_checkout_failed_total');
      throw error;
    }
  }

  private async runCheckoutTransaction(
    manager: EntityManager,
    winnerId: string,
    auctionId: string,
    idempotencyKey: string,
    correlationId: string,
    dto: AuctionCheckoutRequestDto,
  ): Promise<CheckoutOutcome> {
    // Claims (customerId, idempotencyKey) atomically — same mechanism as
    // CheckoutService, reused as-is (the table isn't cart-specific, just a
    // general checkout idempotency ledger keyed by customer + key).
    await manager.insert(CheckoutIdempotencyKey, {
      customerId: winnerId,
      idempotencyKey,
      status: CheckoutIdempotencyStatus.PROCESSING,
    });

    const auction = await manager.findOne(Auction, {
      where: { id: auctionId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!auction) {
      throw new NotFoundException(`Auction ${auctionId} not found`);
    }
    if (auction.winnerId !== winnerId) {
      throw new ForbiddenException(
        'Only the auction winner can complete this purchase',
      );
    }
    if (auction.status !== AuctionStatus.AWAITING_PAYMENT) {
      throw new ConflictException(
        'This auction is not currently awaiting payment',
      );
    }
    if (
      !auction.purchaseWindowEndsAt ||
      Date.now() > auction.purchaseWindowEndsAt.getTime()
    ) {
      throw new ConflictException(
        'The purchase window for this auction has expired',
      );
    }

    const product = await manager.findOne(Product, {
      where: { id: auction.productId },
      relations: { sellerProfile: true },
    });
    if (!product) {
      throw new NotFoundException(`Product ${auction.productId} not found`);
    }

    // Stock is decremented only here, at actual purchase time — never at
    // bid placement or finalization (see README "Auction stock semantics").
    // Guarded the same way as CheckoutService, defensively: an auction
    // product always starts at stockQuantity 1 and nothing else can
    // decrement it, so `affected === 0` here would only mean a bug
    // elsewhere, not a real race.
    const stockResult = await manager
      .createQueryBuilder()
      .update(Product)
      .set({ stockQuantity: () => '"stockQuantity" - 1' })
      .where('id = :id', { id: product.id })
      .andWhere('"stockQuantity" >= 1')
      .execute();
    if (stockResult.affected === 0) {
      throw new ConflictException(
        'This item is no longer available for purchase',
      );
    }

    const priceCents = parseMoneyToCents(auction.currentPrice);
    const commissionCents = applyPercent(
      priceCents,
      product.sellerProfile.commissionRatePercent,
    );
    const netCents = priceCents - commissionCents;

    const order = await manager.save(
      manager.create(Order, {
        buyerId: winnerId,
        totalAmount: auction.currentPrice,
        status: OrderStatus.NEW,
        shippingAddressLine1: dto.shippingAddressLine1 ?? null,
        shippingAddressLine2: dto.shippingAddressLine2 ?? null,
        shippingCity: dto.shippingCity ?? null,
        shippingPostalCode: dto.shippingPostalCode ?? null,
        shippingCountry: dto.shippingCountry ?? null,
      }),
    );

    const sellerOrder = await manager.save(
      manager.create(SellerOrder, {
        orderId: order.id,
        sellerProfileId: product.sellerProfileId,
        subtotal: auction.currentPrice,
        commissionAmount: formatCentsToMoney(commissionCents),
        sellerNetAmount: formatCentsToMoney(netCents),
        status: SellerOrderStatus.AWAITING_FULFILLMENT,
      }),
    );

    await manager.save(
      manager.create(SellerOrderItem, {
        sellerOrderId: sellerOrder.id,
        productId: product.id,
        productName: product.name,
        unitPrice: auction.currentPrice,
        quantity: 1,
        lineTotal: auction.currentPrice,
      }),
    );

    await manager.save(
      manager.create(LedgerEntry, {
        sellerProfileId: product.sellerProfileId,
        type: LedgerEntryType.SALE_CREDIT,
        amount: auction.currentPrice,
        sellerOrderId: sellerOrder.id,
        description: `Auction sale credit for order ${order.id}`,
        correlationId,
      }),
    );
    await manager.save(
      manager.create(LedgerEntry, {
        sellerProfileId: product.sellerProfileId,
        type: LedgerEntryType.COMMISSION_DEBIT,
        amount: formatCentsToMoney(commissionCents),
        sellerOrderId: sellerOrder.id,
        description: `Platform commission for auction order ${order.id}`,
        correlationId,
      }),
    );

    assertValidAuctionTransition(auction.status, AuctionStatus.COMPLETED);
    auction.status = AuctionStatus.COMPLETED;
    await manager.save(auction);

    await this.outboxService.record(manager, {
      eventType: 'ORDER_CREATED',
      aggregateType: 'Order',
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        buyerId: winnerId,
        totalAmount: order.totalAmount,
        sellerOrderIds: [sellerOrder.id],
      },
      correlationId,
    });
    await this.outboxService.record(manager, {
      eventType: 'SELLER_ORDER_CREATED',
      aggregateType: 'SellerOrder',
      aggregateId: sellerOrder.id,
      payload: {
        sellerOrderId: sellerOrder.id,
        orderId: order.id,
        sellerProfileId: product.sellerProfileId,
      },
      correlationId,
    });
    await this.outboxService.record(manager, {
      eventType: 'STOCK_CHANGED',
      aggregateType: 'Product',
      aggregateId: product.id,
      payload: { productId: product.id },
      correlationId,
    });
    await this.outboxService.record(manager, {
      eventType: 'AUCTION_PURCHASED',
      aggregateType: 'Auction',
      aggregateId: auction.id,
      payload: {
        auctionId: auction.id,
        orderId: order.id,
        sellerOrderId: sellerOrder.id,
      },
      correlationId,
    });

    await manager.update(
      CheckoutIdempotencyKey,
      { customerId: winnerId, idempotencyKey },
      { status: CheckoutIdempotencyStatus.COMPLETED, orderId: order.id },
    );

    return { order, sellerOrder, productId: product.id };
  }

  private async replayCompletedCheckout(
    winnerId: string,
    idempotencyKey: string,
  ): Promise<AuctionCheckoutResult> {
    const idempotencyKeyRepository =
      this.auctionsRepository.manager.getRepository(CheckoutIdempotencyKey);
    const claim = await idempotencyKeyRepository.findOne({
      where: { customerId: winnerId, idempotencyKey },
    });
    if (
      !claim ||
      claim.status !== CheckoutIdempotencyStatus.COMPLETED ||
      !claim.orderId
    ) {
      throw new ConflictException(
        'A checkout with this Idempotency-Key is already in progress',
      );
    }

    const order = await this.auctionsRepository.manager
      .getRepository(Order)
      .findOne({
        where: { id: claim.orderId },
        relations: { sellerOrders: true },
      });
    if (!order || order.sellerOrders.length === 0) {
      throw new ConflictException(
        'A checkout with this Idempotency-Key already completed, but the resulting order could not be found',
      );
    }

    return this.toResult(order, order.sellerOrders[0], true);
  }

  private toResult(
    order: Order,
    sellerOrder: SellerOrder,
    replayed: boolean,
  ): AuctionCheckoutResult {
    return {
      orderId: order.id,
      sellerOrderId: sellerOrder.id,
      status: order.status,
      totalAmount: order.totalAmount,
      replayed,
    };
  }
}
