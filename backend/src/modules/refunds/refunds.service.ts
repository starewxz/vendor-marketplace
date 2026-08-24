import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Refund } from './entities/refund.entity';
import { RefundStatus } from './entities/refund-status.enum';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RefundView } from './dto/refund-view';
import { SellerOrder } from '../orders/entities/seller-order.entity';
import { SellerOrderItem } from '../orders/entities/seller-order-item.entity';
import { assertRefundable } from '../orders/domain/seller-order-status.policy';
import { restoreProductStock } from '../orders/stock-restoration.util';
import { LedgerEntry } from '../payments-ledger/entities/ledger-entry.entity';
import { LedgerEntryType } from '../payments-ledger/entities/ledger-entry-type.enum';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { isUniqueViolation } from '../../common/utils/slug';
import {
  applyRatio,
  formatCentsToMoney,
  multiplyCentsByQuantity,
  parseMoneyToCents,
} from '../../common/utils/money';

const IDEMPOTENCY_KEY_MAX_LENGTH = 200;

/**
 * Stage 5 keeps this a single explicit rule rather than reason-dependent
 * logic: a refunded unit always returns to sellable stock. A future stage
 * could add a per-request `restock: boolean` (e.g. for "item damaged,
 * do not resell") — deliberately not built here to avoid a client-trusted
 * flag deciding a financially-adjacent outcome without a real use case yet.
 */
const RESTORE_STOCK_ON_REFUND = true;

interface RefundOutcome {
  refund: Refund;
  touchedProductId: string | null;
  replayed: boolean;
}

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    @InjectRepository(Refund)
    private readonly refundsRepository: Repository<Refund>,
    private readonly outboxService: OutboxService,
    private readonly cache: CatalogCacheService,
    private readonly metrics: MetricsRegistryService,
  ) {}

  async createRefund(
    sellerOrderId: string,
    dto: CreateRefundDto,
    idempotencyKey: string | undefined,
    initiatedBy: string,
    correlationId: string,
  ): Promise<RefundView> {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new BadRequestException('Idempotency-Key header is too long');
    }

    this.logger.log(
      `[${correlationId}] refund attempt sellerOrderId=${sellerOrderId} sellerOrderItemId=${dto.sellerOrderItemId} quantity=${dto.quantity} idempotencyKey=${idempotencyKey}`,
    );

    try {
      const outcome = await this.refundsRepository.manager.transaction(
        (manager) =>
          this.runRefundTransaction(
            manager,
            sellerOrderId,
            dto,
            idempotencyKey,
            initiatedBy,
            correlationId,
          ),
      );

      if (outcome.touchedProductId) {
        await this.cache.invalidateProduct(outcome.touchedProductId);
        await this.cache.invalidateSearch();
      }

      this.metrics.increment('refunds_total');
      // Unit is cents (integer counter) — divide by 100 for dollars when
      // reading this metric; kept as an integer here since the registry
      // only supports whole-number counters.
      this.metrics.increment(
        'refund_amount_total',
        Number(parseMoneyToCents(outcome.refund.amount)),
      );
      this.logger.log(
        `[${correlationId}] refund created refundId=${outcome.refund.id} amount=${outcome.refund.amount} commissionAdjustment=${outcome.refund.commissionAdjustment} sellerAdjustment=${outcome.refund.sellerAdjustment}`,
      );

      return this.toView(outcome.refund);
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.log(
          `[${correlationId}] refund idempotent replay sellerOrderId=${sellerOrderId} idempotencyKey=${idempotencyKey}`,
        );
        return this.replayCompletedRefund(sellerOrderId, idempotencyKey);
      }
      this.metrics.increment('refund_failures_total');
      throw error;
    }
  }

  async findBySellerOrder(sellerOrderId: string): Promise<RefundView[]> {
    const refunds = await this.refundsRepository.find({
      where: { sellerOrderId },
      order: { createdAt: 'DESC' },
    });
    return refunds.map((r) => this.toView(r));
  }

  private async runRefundTransaction(
    manager: EntityManager,
    sellerOrderId: string,
    dto: CreateRefundDto,
    idempotencyKey: string,
    initiatedBy: string,
    correlationId: string,
  ): Promise<RefundOutcome> {
    // Locking the SellerOrder is what serializes every concurrent path
    // that touches its financial state — a second concurrent refund
    // request for the same item, a second identical request replaying
    // this one, or a simultaneous full cancellation — all block here
    // until this transaction commits or rolls back.
    const sellerOrder = await manager.findOne(SellerOrder, {
      where: { id: sellerOrderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!sellerOrder) {
      throw new NotFoundException(`Seller order ${sellerOrderId} not found`);
    }
    assertRefundable(sellerOrder.status);

    const item = await manager.findOne(SellerOrderItem, {
      where: { id: dto.sellerOrderItemId, sellerOrderId },
    });
    if (!item) {
      throw new NotFoundException(
        `Item ${dto.sellerOrderItemId} does not belong to seller order ${sellerOrderId}`,
      );
    }

    const priorRefunds = await manager.find(Refund, {
      where: { sellerOrderItemId: item.id, status: RefundStatus.COMPLETED },
    });
    const alreadyRefundedQty = priorRefunds.reduce(
      (sum, r) => sum + r.quantity,
      0,
    );
    const remainingQty = item.quantity - alreadyRefundedQty;
    if (dto.quantity > remainingQty) {
      throw new ConflictException(
        `Only ${remainingQty} unit(s) of "${item.productName}" remain refundable (${alreadyRefundedQty} of ${item.quantity} already refunded)`,
      );
    }

    // Gross refund is computed from the immutable purchase snapshot, never
    // current product price. Commission/seller corrections are computed
    // from the SellerOrder's own stored subtotal/commission ratio — not by
    // re-reading the seller's *current* commission rate — so the numbers
    // still reconcile exactly even if that rate changed since the sale.
    const unitPriceCents = parseMoneyToCents(item.unitPrice);
    const refundGrossCents = multiplyCentsByQuantity(
      unitPriceCents,
      dto.quantity,
    );
    const subtotalCents = parseMoneyToCents(sellerOrder.subtotal);
    const commissionCents = parseMoneyToCents(sellerOrder.commissionAmount);
    const commissionCorrectionCents = applyRatio(
      refundGrossCents,
      commissionCents,
      subtotalCents,
    );
    const sellerAdjustmentCents = refundGrossCents - commissionCorrectionCents;

    // This insert is the idempotency claim itself — the unique index on
    // (sellerOrderId, idempotencyKey) is what makes a retried or
    // concurrently-duplicated request produce exactly one Refund. Unlike
    // checkout's two-phase claim, everything needed is already computed,
    // so this goes straight to COMPLETED in one insert.
    const refund = await manager.save(
      manager.create(Refund, {
        sellerOrderId,
        sellerOrderItemId: item.id,
        quantity: dto.quantity,
        amount: formatCentsToMoney(refundGrossCents),
        commissionAdjustment: formatCentsToMoney(commissionCorrectionCents),
        sellerAdjustment: formatCentsToMoney(sellerAdjustmentCents),
        reason: dto.reason ?? null,
        status: RefundStatus.COMPLETED,
        idempotencyKey,
        initiatedBy,
        correlationId,
      }),
    );

    await manager.save(
      manager.create(LedgerEntry, {
        sellerProfileId: sellerOrder.sellerProfileId,
        type: LedgerEntryType.SELLER_EARNING_REVERSAL,
        amount: refund.amount,
        sellerOrderId,
        refundId: refund.id,
        description: `Partial refund reversal for seller order ${sellerOrderId}`,
        correlationId,
      }),
    );
    await manager.save(
      manager.create(LedgerEntry, {
        sellerProfileId: sellerOrder.sellerProfileId,
        type: LedgerEntryType.PLATFORM_COMMISSION_REVERSAL,
        amount: refund.commissionAdjustment,
        sellerOrderId,
        refundId: refund.id,
        description: `Commission reversal for partial refund of seller order ${sellerOrderId}`,
        correlationId,
      }),
    );

    let touchedProductId: string | null = null;
    if (RESTORE_STOCK_ON_REFUND && item.productId) {
      const restored = await restoreProductStock(
        manager,
        item.productId,
        dto.quantity,
        correlationId,
        this.logger,
      );
      if (restored) {
        touchedProductId = item.productId;
        await this.outboxService.record(manager, {
          eventType: 'STOCK_CHANGED',
          aggregateType: 'Product',
          aggregateId: item.productId,
          payload: { productId: item.productId },
          correlationId,
        });
      }
    }

    await this.outboxService.record(manager, {
      eventType: 'REFUND_CREATED',
      aggregateType: 'Refund',
      aggregateId: refund.id,
      payload: {
        refundId: refund.id,
        sellerOrderId,
        sellerOrderItemId: item.id,
        quantity: dto.quantity,
      },
      correlationId,
    });

    return { refund, touchedProductId, replayed: false };
  }

  private async replayCompletedRefund(
    sellerOrderId: string,
    idempotencyKey: string,
  ): Promise<RefundView> {
    const existing = await this.refundsRepository.findOne({
      where: { sellerOrderId, idempotencyKey },
    });
    if (!existing || existing.status !== RefundStatus.COMPLETED) {
      throw new ConflictException(
        'A refund with this Idempotency-Key is already in progress',
      );
    }
    return this.toView(existing);
  }

  private toView(refund: Refund): RefundView {
    return {
      id: refund.id,
      sellerOrderId: refund.sellerOrderId,
      sellerOrderItemId: refund.sellerOrderItemId,
      quantity: refund.quantity,
      amount: refund.amount,
      commissionAdjustment: refund.commissionAdjustment,
      sellerAdjustment: refund.sellerAdjustment,
      reason: refund.reason,
      status: refund.status,
      createdAt: refund.createdAt,
    };
  }
}
