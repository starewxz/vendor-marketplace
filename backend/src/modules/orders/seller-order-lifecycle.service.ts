import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { SellerOrder } from './entities/seller-order.entity';
import { SellerOrderStatus } from './entities/seller-order-status.enum';
import { SellerOrderItem } from './entities/seller-order-item.entity';
import {
  assertCancellable,
  assertValidStatusTransition,
} from './domain/seller-order-status.policy';
import { deriveParentOrderStatus } from './domain/order-aggregate-status';
import { restoreProductStock } from './stock-restoration.util';
import { LedgerEntry } from '../payments-ledger/entities/ledger-entry.entity';
import { LedgerEntryType } from '../payments-ledger/entities/ledger-entry-type.enum';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';

/** Identifies who's performing the action — an admin acts unscoped, a
 * seller is always scoped to their own SellerProfile. The same domain
 * transition rules apply to both (see domain/seller-order-status.policy) —
 * this type only ever changes *which row can be found*, never *what
 * transition is legal*. */
export type LifecycleActor =
  { type: 'seller'; sellerProfileId: string } | { type: 'admin' };

interface CancelOutcome {
  sellerOrder: SellerOrder;
  touchedProductIds: string[];
  alreadyCancelled: boolean;
}

@Injectable()
export class SellerOrderLifecycleService {
  private readonly logger = new Logger(SellerOrderLifecycleService.name);

  constructor(
    @InjectRepository(SellerOrder)
    private readonly sellerOrdersRepository: Repository<SellerOrder>,
    private readonly outboxService: OutboxService,
    private readonly cache: CatalogCacheService,
    private readonly metrics: MetricsRegistryService,
  ) {}

  async updateStatus(
    actor: LifecycleActor,
    sellerOrderId: string,
    targetStatus: SellerOrderStatus,
    correlationId: string,
  ): Promise<SellerOrder> {
    const updated = await this.sellerOrdersRepository.manager.transaction(
      async (manager) => {
        const sellerOrder = await this.lockOwnedSellerOrder(
          manager,
          actor,
          sellerOrderId,
        );

        assertValidStatusTransition(sellerOrder.status, targetStatus);

        const previousStatus = sellerOrder.status;
        sellerOrder.status = targetStatus;
        await manager.save(sellerOrder);

        this.logger.log(
          `[${correlationId}] seller order status changed sellerOrderId=${sellerOrderId} from=${previousStatus} to=${targetStatus}`,
        );
        this.metrics.increment('seller_order_status_changes_total');

        await this.outboxService.record(manager, {
          eventType: 'SELLER_ORDER_STATUS_CHANGED',
          aggregateType: 'SellerOrder',
          aggregateId: sellerOrder.id,
          payload: {
            sellerOrderId: sellerOrder.id,
            orderId: sellerOrder.orderId,
            from: previousStatus,
            to: targetStatus,
          },
          correlationId,
        });

        await this.recomputeParentOrderStatus(
          manager,
          sellerOrder.orderId,
          correlationId,
        );

        return sellerOrder;
      },
    );

    return updated;
  }

  async cancel(
    actor: LifecycleActor,
    sellerOrderId: string,
    correlationId: string,
  ): Promise<SellerOrder> {
    const outcome = await this.sellerOrdersRepository.manager.transaction(
      (manager) =>
        this.runCancelTransaction(manager, actor, sellerOrderId, correlationId),
    );

    if (!outcome.alreadyCancelled) {
      // Best-effort, post-commit only — see CheckoutService for the same
      // pattern and reasoning (a Redis outage must never fail an
      // already-committed cancellation).
      await Promise.all(
        outcome.touchedProductIds.map((id) => this.cache.invalidateProduct(id)),
      );
      await this.cache.invalidateSearch();
    }

    return outcome.sellerOrder;
  }

  private async runCancelTransaction(
    manager: EntityManager,
    actor: LifecycleActor,
    sellerOrderId: string,
    correlationId: string,
  ): Promise<CancelOutcome> {
    const sellerOrder = await this.lockOwnedSellerOrder(
      manager,
      actor,
      sellerOrderId,
    );

    if (sellerOrder.status === SellerOrderStatus.CANCELLED) {
      // Idempotent no-op: a repeated (or concurrently-raced, now-serialized
      // by the row lock above) cancel request must not restore stock or
      // reverse the ledger a second time.
      this.logger.log(
        `[${correlationId}] seller order ${sellerOrderId} already cancelled, no-op`,
      );
      return { sellerOrder, touchedProductIds: [], alreadyCancelled: true };
    }

    assertCancellable(sellerOrder.status);

    const items = await manager.find(SellerOrderItem, {
      where: { sellerOrderId },
    });

    const touchedProductIds: string[] = [];
    for (const item of items) {
      if (!item.productId) continue;
      const restored = await restoreProductStock(
        manager,
        item.productId,
        item.quantity,
        correlationId,
        this.logger,
      );
      if (restored) {
        touchedProductIds.push(item.productId);
        await this.outboxService.record(manager, {
          eventType: 'STOCK_CHANGED',
          aggregateType: 'Product',
          aggregateId: item.productId,
          payload: { productId: item.productId },
          correlationId,
        });
      }
    }

    await manager.save(
      manager.create(LedgerEntry, {
        sellerProfileId: sellerOrder.sellerProfileId,
        type: LedgerEntryType.SELLER_EARNING_REVERSAL,
        amount: sellerOrder.subtotal,
        sellerOrderId: sellerOrder.id,
        description: `Full cancellation reversal for seller order ${sellerOrder.id}`,
        correlationId,
      }),
    );
    await manager.save(
      manager.create(LedgerEntry, {
        sellerProfileId: sellerOrder.sellerProfileId,
        type: LedgerEntryType.PLATFORM_COMMISSION_REVERSAL,
        amount: sellerOrder.commissionAmount,
        sellerOrderId: sellerOrder.id,
        description: `Commission reversal for cancelled seller order ${sellerOrder.id}`,
        correlationId,
      }),
    );
    this.metrics.increment('seller_order_cancellations_total');
    this.logger.log(
      `[${correlationId}] seller order cancelled sellerOrderId=${sellerOrderId} subtotalReversed=${sellerOrder.subtotal} commissionReversed=${sellerOrder.commissionAmount}`,
    );

    sellerOrder.status = SellerOrderStatus.CANCELLED;
    await manager.save(sellerOrder);

    await this.outboxService.record(manager, {
      eventType: 'SELLER_ORDER_CANCELLED',
      aggregateType: 'SellerOrder',
      aggregateId: sellerOrder.id,
      payload: { sellerOrderId: sellerOrder.id, orderId: sellerOrder.orderId },
      correlationId,
    });

    await this.recomputeParentOrderStatus(
      manager,
      sellerOrder.orderId,
      correlationId,
    );

    return { sellerOrder, touchedProductIds, alreadyCancelled: false };
  }

  /** Re-derives and persists the parent Order's aggregate status from
   * every one of its SellerOrders' *current* status — called at the end
   * of every transaction that changes a SellerOrder's status. Emits
   * ORDER_STATUS_CHANGED only when the aggregate actually moved. */
  private async recomputeParentOrderStatus(
    manager: EntityManager,
    orderId: string,
    correlationId: string,
  ): Promise<void> {
    const siblings = await manager.find(SellerOrder, { where: { orderId } });
    const nextStatus = deriveParentOrderStatus(siblings.map((s) => s.status));

    const order = await manager.findOne(Order, { where: { id: orderId } });
    if (!order || order.status === nextStatus) {
      return;
    }

    const previousStatus = order.status;
    order.status = nextStatus;
    await manager.save(order);

    this.logger.log(
      `[${correlationId}] parent order status recomputed orderId=${orderId} from=${previousStatus} to=${nextStatus}`,
    );

    await this.outboxService.record(manager, {
      eventType: 'ORDER_STATUS_CHANGED',
      aggregateType: 'Order',
      aggregateId: orderId,
      payload: { orderId, from: previousStatus, to: nextStatus },
      correlationId,
    });
  }

  private async lockOwnedSellerOrder(
    manager: EntityManager,
    actor: LifecycleActor,
    sellerOrderId: string,
  ): Promise<SellerOrder> {
    const where =
      actor.type === 'seller'
        ? { id: sellerOrderId, sellerProfileId: actor.sellerProfileId }
        : { id: sellerOrderId };

    const sellerOrder = await manager.findOne(SellerOrder, {
      where,
      lock: { mode: 'pessimistic_write' },
    });
    if (!sellerOrder) {
      throw new NotFoundException(`Seller order ${sellerOrderId} not found`);
    }
    return sellerOrder;
  }
}
