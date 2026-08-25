import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductType } from '../products/entities/product-type.enum';
import { SellerProfile } from '../sellers/entities/seller-profile.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order-status.enum';
import { SellerOrder } from '../orders/entities/seller-order.entity';
import { SellerOrderStatus } from '../orders/entities/seller-order-status.enum';
import { SellerOrderItem } from '../orders/entities/seller-order-item.entity';
import { CheckoutIdempotencyKey } from '../orders/entities/checkout-idempotency-key.entity';
import { CheckoutIdempotencyStatus } from '../orders/entities/checkout-idempotency-status.enum';
import { LedgerEntry } from '../payments-ledger/entities/ledger-entry.entity';
import { LedgerEntryType } from '../payments-ledger/entities/ledger-entry-type.enum';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { isUniqueViolation } from '../../common/utils/slug';
import {
  applyPercent,
  formatCentsToMoney,
  multiplyCentsByQuantity,
  parseMoneyToCents,
  sumCents,
} from '../../common/utils/money';
import { CheckoutRequestDto } from './dto/checkout-request.dto';
import { CheckoutResult } from './dto/checkout-result';

const IDEMPOTENCY_KEY_MAX_LENGTH = 200;

interface TransactionOutcome {
  order: Order;
  sellerOrders: SellerOrder[];
  touchedProductIds: string[];
}

/**
 * Every write in here happens through the same EntityManager, inside one
 * `manager.transaction` block — see README "Consistency model". Nothing is
 * published to BullMQ or Redis until after that transaction commits: the
 * outbox rows are written in-transaction, and a separate publisher relays
 * them afterward (see OutboxPublisherService), so a rollback here can never
 * leave a half-delivered side effect.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly outboxService: OutboxService,
    private readonly cache: CatalogCacheService,
    private readonly metrics: MetricsRegistryService,
  ) {}

  async checkout(
    customerId: string,
    idempotencyKey: string | undefined,
    correlationId: string,
    dto: CheckoutRequestDto,
  ): Promise<CheckoutResult> {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new BadRequestException('Idempotency-Key header is too long');
    }

    this.logger.log(
      `[${correlationId}] checkout attempt customerId=${customerId} idempotencyKey=${idempotencyKey}`,
    );
    this.metrics.increment('checkout_attempts_total');

    try {
      const outcome = await this.ordersRepository.manager.transaction(
        (manager) =>
          this.runCheckoutTransaction(
            manager,
            customerId,
            idempotencyKey,
            correlationId,
            dto,
          ),
      );

      // Best-effort, post-commit only — a Redis outage here must never
      // fail an already-committed order. See CatalogCacheService: every
      // method degrades to a no-op cache-miss internally.
      await Promise.all(
        outcome.touchedProductIds.map((id) => this.cache.invalidateProduct(id)),
      );
      await this.cache.invalidateSearch();

      this.logger.log(
        `[${correlationId}] checkout completed orderId=${outcome.order.id} sellerOrders=${outcome.sellerOrders.length}`,
      );
      this.metrics.increment('checkout_succeeded_total');
      this.metrics.increment('orders_created_total');
      return this.toResult(outcome.order, outcome.sellerOrders, false);
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.log(
          `[${correlationId}] checkout idempotent replay customerId=${customerId} idempotencyKey=${idempotencyKey}`,
        );
        this.metrics.increment('checkout_idempotent_replays_total');
        return this.replayCompletedCheckout(customerId, idempotencyKey);
      }
      this.metrics.increment('checkout_failed_total');
      throw error;
    }
  }

  private async runCheckoutTransaction(
    manager: EntityManager,
    customerId: string,
    idempotencyKey: string,
    correlationId: string,
    dto: CheckoutRequestDto,
  ): Promise<TransactionOutcome> {
    // Claims (customerId, idempotencyKey) atomically. The unique index on
    // this table is what makes concurrent duplicate requests safe: a
    // second transaction inserting the same pair blocks on this row until
    // we commit or roll back, then either finds our COMPLETED row (replay)
    // or finds nothing (we rolled back — the key is free again).
    await manager.insert(CheckoutIdempotencyKey, {
      customerId,
      idempotencyKey,
      status: CheckoutIdempotencyStatus.PROCESSING,
    });

    const cart = await manager.findOne(Cart, { where: { userId: customerId } });
    if (!cart) {
      throw new BadRequestException('Cart is empty');
    }

    const cartItems = await manager.find(CartItem, {
      where: { cartId: cart.id },
      relations: { product: { sellerProfile: true } },
      // Deterministic lock acquisition order across every checkout in the
      // system prevents cross-checkout deadlocks when two carts share a
      // product.
      order: { productId: 'ASC' },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    for (const item of cartItems) {
      this.assertPurchasable(item);
    }

    const touchedProductIds: string[] = [];
    for (const item of cartItems) {
      const result = await manager
        .createQueryBuilder()
        .update(Product)
        .set({ stockQuantity: () => '"stockQuantity" - :qty' })
        .where('id = :id', { id: item.productId })
        .andWhere('"stockQuantity" >= :qty')
        .setParameter('qty', item.quantity)
        .execute();

      if (result.affected === 0) {
        this.logger.warn(
          `[${correlationId}] stock conflict productId=${item.productId} requested=${item.quantity}`,
        );
        this.metrics.increment('stock_conflicts_total');
        throw new ConflictException(
          `Only a limited quantity of "${item.product.name}" is available — please update your cart`,
        );
      }
      touchedProductIds.push(item.productId);
    }

    const groups = this.groupBySeller(cartItems);

    const totalCents = sumCents(
      cartItems.map((item) => this.lineTotalCents(item)),
    );
    const order = await manager.save(
      manager.create(Order, {
        buyerId: customerId,
        totalAmount: formatCentsToMoney(totalCents),
        status: OrderStatus.NEW,
        shippingAddressLine1: dto.shippingAddressLine1 ?? null,
        shippingAddressLine2: dto.shippingAddressLine2 ?? null,
        shippingCity: dto.shippingCity ?? null,
        shippingPostalCode: dto.shippingPostalCode ?? null,
        shippingCountry: dto.shippingCountry ?? null,
      }),
    );

    const sellerOrders: SellerOrder[] = [];
    for (const group of groups) {
      const sellerOrder = await this.createSellerOrder(
        manager,
        order,
        group,
        correlationId,
      );
      sellerOrders.push(sellerOrder);
    }

    await this.outboxService.record(manager, {
      eventType: 'ORDER_CREATED',
      aggregateType: 'Order',
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        buyerId: customerId,
        totalAmount: order.totalAmount,
        sellerOrderIds: sellerOrders.map((s) => s.id),
      },
      correlationId,
    });

    for (const productId of touchedProductIds) {
      await this.outboxService.record(manager, {
        eventType: 'STOCK_CHANGED',
        aggregateType: 'Product',
        aggregateId: productId,
        payload: { productId },
        correlationId,
      });
    }

    await manager.delete(CartItem, { cartId: cart.id });

    await manager.update(
      CheckoutIdempotencyKey,
      { customerId, idempotencyKey },
      { status: CheckoutIdempotencyStatus.COMPLETED, orderId: order.id },
    );

    return { order, sellerOrders, touchedProductIds };
  }

  private async createSellerOrder(
    manager: EntityManager,
    order: Order,
    group: { sellerProfile: SellerProfile; items: CartItem[] },
    correlationId: string,
  ): Promise<SellerOrder> {
    const subtotalCents = sumCents(
      group.items.map((item) => this.lineTotalCents(item)),
    );
    const commissionCents = applyPercent(
      subtotalCents,
      group.sellerProfile.commissionRatePercent,
    );
    const netCents = subtotalCents - commissionCents;

    const sellerOrder = await manager.save(
      manager.create(SellerOrder, {
        orderId: order.id,
        sellerProfileId: group.sellerProfile.id,
        subtotal: formatCentsToMoney(subtotalCents),
        commissionAmount: formatCentsToMoney(commissionCents),
        sellerNetAmount: formatCentsToMoney(netCents),
        status: SellerOrderStatus.AWAITING_FULFILLMENT,
      }),
    );

    for (const item of group.items) {
      await manager.save(
        manager.create(SellerOrderItem, {
          sellerOrderId: sellerOrder.id,
          productId: item.productId,
          productName: item.product.name,
          unitPrice: item.product.price as string,
          quantity: item.quantity,
          lineTotal: formatCentsToMoney(this.lineTotalCents(item)),
        }),
      );
    }

    await manager.save(
      manager.create(LedgerEntry, {
        sellerProfileId: group.sellerProfile.id,
        type: LedgerEntryType.SALE_CREDIT,
        amount: formatCentsToMoney(subtotalCents),
        sellerOrderId: sellerOrder.id,
        description: `Sale credit for order ${order.id}`,
        correlationId,
      }),
    );
    await manager.save(
      manager.create(LedgerEntry, {
        sellerProfileId: group.sellerProfile.id,
        type: LedgerEntryType.COMMISSION_DEBIT,
        amount: formatCentsToMoney(commissionCents),
        sellerOrderId: sellerOrder.id,
        description: `Platform commission for order ${order.id}`,
        correlationId,
      }),
    );

    this.logger.log(
      `[${correlationId}] seller order created sellerOrderId=${sellerOrder.id} sellerProfileId=${group.sellerProfile.id} subtotal=${sellerOrder.subtotal} commission=${sellerOrder.commissionAmount}`,
    );

    await this.outboxService.record(manager, {
      eventType: 'SELLER_ORDER_CREATED',
      aggregateType: 'SellerOrder',
      aggregateId: sellerOrder.id,
      payload: {
        sellerOrderId: sellerOrder.id,
        orderId: order.id,
        sellerProfileId: group.sellerProfile.id,
      },
      correlationId,
    });

    return sellerOrder;
  }

  private assertPurchasable(item: CartItem): void {
    const product = item.product;
    if (!product || !product.isPublished) {
      throw new ConflictException(
        `A product in your cart is no longer available — please update your cart`,
      );
    }
    if (product.type !== ProductType.FIXED_PRICE || product.price === null) {
      throw new ConflictException(
        `"${product.name}" is no longer available for direct purchase`,
      );
    }
  }

  private lineTotalCents(item: CartItem): bigint {
    return multiplyCentsByQuantity(
      parseMoneyToCents(item.product.price as string),
      item.quantity,
    );
  }

  private groupBySeller(
    cartItems: CartItem[],
  ): { sellerProfile: SellerProfile; items: CartItem[] }[] {
    const groups = new Map<
      string,
      { sellerProfile: SellerProfile; items: CartItem[] }
    >();
    for (const item of cartItems) {
      const sellerProfileId = item.product.sellerProfileId;
      let group = groups.get(sellerProfileId);
      if (!group) {
        group = { sellerProfile: item.product.sellerProfile, items: [] };
        groups.set(sellerProfileId, group);
      }
      group.items.push(item);
    }
    return Array.from(groups.values());
  }

  private async replayCompletedCheckout(
    customerId: string,
    idempotencyKey: string,
  ): Promise<CheckoutResult> {
    const idempotencyKeyRepository =
      this.ordersRepository.manager.getRepository(CheckoutIdempotencyKey);
    const claim = await idempotencyKeyRepository.findOne({
      where: { customerId, idempotencyKey },
    });

    if (
      !claim ||
      claim.status !== CheckoutIdempotencyStatus.COMPLETED ||
      !claim.orderId
    ) {
      // The conflicting transaction is still in flight (rare — plain
      // inserts already wait for it to finish) or something inserted a
      // stuck row out of band. Either way, this is not our order to return.
      throw new ConflictException(
        'A checkout with this Idempotency-Key is already in progress',
      );
    }

    const order = await this.ordersRepository.findOne({
      where: { id: claim.orderId },
      relations: { sellerOrders: true },
    });
    if (!order) {
      throw new ConflictException(
        'A checkout with this Idempotency-Key already completed, but the resulting order could not be found',
      );
    }

    return this.toResult(order, order.sellerOrders, true);
  }

  private toResult(
    order: Order,
    sellerOrders: SellerOrder[],
    replayed: boolean,
  ): CheckoutResult {
    return {
      orderId: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      sellerOrders: sellerOrders.map((so) => ({
        id: so.id,
        sellerProfileId: so.sellerProfileId,
        subtotal: so.subtotal,
        commissionAmount: so.commissionAmount,
        sellerNetAmount: so.sellerNetAmount,
        status: so.status,
      })),
      replayed,
    };
  }
}
