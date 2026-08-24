import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EntityManager, Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { AuctionStatus } from './entities/auction-status.enum';
import { Bid } from './entities/bid.entity';
import { Product } from '../products/entities/product.entity';
import {
  assertAuctionCancellable,
  assertValidAuctionTransition,
} from './domain/auction-status.policy';
import {
  AuctionFinalizationJobData,
  AuctionJobType,
} from './auction-finalization.types';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { ConfigService } from '@nestjs/config';

/** Mirrors orders/seller-order-lifecycle.service.ts's LifecycleActor — admin
 * acts unscoped, a seller is scoped to owning the Auction's Product. */
export type AuctionLifecycleActor =
  { type: 'seller'; sellerProfileId: string } | { type: 'admin' };

/**
 * Fixed rather than per-auction/configurable via the API — the stage spec
 * allows either; a single env-free constant keeps the state machine easy to
 * reason about and test. 30 minutes is the upper end of the spec's
 * suggested 15-30 minute range.
 */
interface FinalizeOutcome {
  touched: boolean;
  productId: string | null;
  schedulePurchaseWindowExpiry: Date | null;
}

interface ExpireOutcome {
  touched: boolean;
  productId: string | null;
}

interface CancelOutcome {
  auction: Auction;
  touched: boolean;
}

/**
 * Owns every Auction status transition that isn't the initial bid-driven
 * currentPrice bump (see BidPlacementService) and every BullMQ interaction
 * on QUEUE_NAMES.AUCTION_FINALIZATION. Both delayed-job triggers and the
 * periodic reconciliation sweep (AuctionReconciliationService) call the
 * same finalizeAuction/expirePurchaseWindow methods, which are idempotent
 * (locked, status-checked no-ops on redelivery) — so double-processing from
 * either source is always harmless.
 */
@Injectable()
export class AuctionLifecycleService {
  private readonly logger = new Logger(AuctionLifecycleService.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
    @InjectQueue(QUEUE_NAMES.AUCTION_FINALIZATION)
    private readonly finalizationQueue: Queue<AuctionFinalizationJobData>,
    private readonly outboxService: OutboxService,
    private readonly cache: CatalogCacheService,
    private readonly metrics: MetricsRegistryService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------------
  // BullMQ scheduling
  // ---------------------------------------------------------------------

  async scheduleFinalization(
    auctionId: string,
    endsAt: Date,
    correlationId: string,
  ): Promise<void> {
    await this.addDelayedJob(
      this.finalizeJobId(auctionId),
      'FINALIZE',
      auctionId,
      endsAt,
      correlationId,
    );
  }

  async rescheduleFinalization(
    auctionId: string,
    endsAt: Date,
    correlationId: string,
  ): Promise<void> {
    await this.removeScheduledJob(this.finalizeJobId(auctionId));
    await this.scheduleFinalization(auctionId, endsAt, correlationId);
  }

  async cancelScheduledFinalization(auctionId: string): Promise<void> {
    await this.removeScheduledJob(this.finalizeJobId(auctionId));
    await this.removeScheduledJob(this.expireJobId(auctionId));
  }

  private async schedulePurchaseWindowExpiry(
    auctionId: string,
    purchaseWindowEndsAt: Date,
    correlationId: string,
  ): Promise<void> {
    await this.addDelayedJob(
      this.expireJobId(auctionId),
      'EXPIRE_PURCHASE_WINDOW',
      auctionId,
      purchaseWindowEndsAt,
      correlationId,
    );
  }

  private finalizeJobId(auctionId: string): string {
    return `auction-finalize:${auctionId}`;
  }

  private expireJobId(auctionId: string): string {
    return `auction-expire:${auctionId}`;
  }

  /**
   * `jobId` dedup means a redundant add() for a job already scheduled is a
   * safe no-op (same reasoning as OutboxPublisherService's use of the
   * outbox row id as jobId). If Redis is briefly unavailable this throws
   * and is swallowed — AuctionReconciliationService's periodic sweep is the
   * reliability backstop for a delayed job that never got scheduled.
   */
  private async addDelayedJob(
    jobId: string,
    type: AuctionJobType,
    auctionId: string,
    at: Date,
    correlationId: string,
  ): Promise<void> {
    const delay = Math.max(0, at.getTime() - Date.now());
    try {
      await this.finalizationQueue.add(
        type,
        { type, auctionId, correlationId },
        {
          jobId,
          delay,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
    } catch (error) {
      this.logger.warn(
        `[${correlationId}] failed to schedule ${type} job for auction ${auctionId}, relying on reconciliation: ${(error as Error).message}`,
      );
    }
  }

  private async removeScheduledJob(jobId: string): Promise<void> {
    try {
      const job = await this.finalizationQueue.getJob(jobId);
      if (job) {
        await job.remove();
      }
    } catch (error) {
      this.logger.warn(
        `failed to remove scheduled job ${jobId}: ${(error as Error).message}`,
      );
    }
  }

  // ---------------------------------------------------------------------
  // Finalize: ACTIVE -> UNSOLD (no bids) | AWAITING_PAYMENT (has a winner)
  // ---------------------------------------------------------------------

  async finalizeAuction(
    auctionId: string,
    correlationId: string,
  ): Promise<void> {
    const outcome = await this.auctionsRepository.manager.transaction(
      (manager) =>
        this.runFinalizeTransaction(manager, auctionId, correlationId),
    );

    if (outcome.schedulePurchaseWindowExpiry) {
      await this.schedulePurchaseWindowExpiry(
        auctionId,
        outcome.schedulePurchaseWindowExpiry,
        correlationId,
      );
    }
    if (outcome.touched && outcome.productId) {
      await this.cache.invalidateProduct(outcome.productId);
      await this.cache.invalidateSearch();
    }
  }

  private async runFinalizeTransaction(
    manager: EntityManager,
    auctionId: string,
    correlationId: string,
  ): Promise<FinalizeOutcome> {
    const auction = await manager.findOne(Auction, {
      where: { id: auctionId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!auction) {
      this.logger.warn(
        `[${correlationId}] finalize found no auction id=${auctionId}, skipping`,
      );
      return {
        touched: false,
        productId: null,
        schedulePurchaseWindowExpiry: null,
      };
    }

    if (
      auction.status !== AuctionStatus.ACTIVE &&
      auction.status !== AuctionStatus.SCHEDULED
    ) {
      // Already finalized by the other trigger (job vs. reconciliation), or
      // cancelled in the meantime — idempotent no-op.
      return {
        touched: false,
        productId: auction.productId,
        schedulePurchaseWindowExpiry: null,
      };
    }
    if (Date.now() < auction.endsAt.getTime()) {
      // Defensive: called before the deadline actually passed (shouldn't
      // happen — the delayed job's own delay accounts for this — but the
      // reconciliation sweep re-checks endsAt itself before calling in).
      return {
        touched: false,
        productId: auction.productId,
        schedulePurchaseWindowExpiry: null,
      };
    }

    // A future-scheduled auction may reach its deadline without receiving a
    // bid. Bids normally persist SCHEDULED -> ACTIVE, but a zero-bid auction
    // has no request to perform that promotion. The deadline job therefore
    // self-heals it under the same row lock before applying the normal
    // ACTIVE finalization rules.
    if (auction.status === AuctionStatus.SCHEDULED) {
      assertValidAuctionTransition(auction.status, AuctionStatus.ACTIVE);
      auction.status = AuctionStatus.ACTIVE;
    }

    // Highest amount wins; earliest of ties wins — Postgres sorts this
    // `numeric` column numerically, not lexically, so this is a real
    // numeric ORDER BY even though the JS-side value is a decimal string.
    const winningBid = await manager.findOne(Bid, {
      where: { auctionId },
      order: { amount: 'DESC', createdAt: 'ASC' },
    });

    if (!winningBid) {
      assertValidAuctionTransition(auction.status, AuctionStatus.UNSOLD);
      auction.status = AuctionStatus.UNSOLD;
      auction.finalizedAt = new Date();
      await manager.save(auction);

      await this.outboxService.record(manager, {
        eventType: 'AUCTION_UNSOLD',
        aggregateType: 'Auction',
        aggregateId: auction.id,
        payload: { auctionId: auction.id, productId: auction.productId },
        correlationId,
      });
      await this.recordProductProjectionEvent(manager, auction, correlationId);
      await this.recordFinalizedEvent(manager, auction, correlationId);
      this.metrics.increment('auctions_unsold_total');
      this.logger.log(
        `[${correlationId}] auction ${auction.id} finalized with no bids -> UNSOLD`,
      );
      return {
        touched: true,
        productId: auction.productId,
        schedulePurchaseWindowExpiry: null,
      };
    }

    const purchaseWindowEndsAt = new Date(
      Date.now() +
        this.config.get<number>('auctions.purchaseWindowMinutes', 30) * 60_000,
    );

    assertValidAuctionTransition(
      auction.status,
      AuctionStatus.AWAITING_PAYMENT,
    );
    auction.winnerId = winningBid.bidderId;
    auction.currentPrice = winningBid.amount;
    auction.purchaseWindowEndsAt = purchaseWindowEndsAt;
    auction.winningBidId = winningBid.id;
    auction.finalizedAt = new Date();
    auction.status = AuctionStatus.AWAITING_PAYMENT;
    await manager.save(auction);

    await this.outboxService.record(manager, {
      eventType: 'AUCTION_WON',
      aggregateType: 'Auction',
      aggregateId: auction.id,
      payload: {
        auctionId: auction.id,
        productId: auction.productId,
        winnerId: auction.winnerId,
        winningAmount: auction.currentPrice,
      },
      correlationId,
    });
    await this.recordProductProjectionEvent(manager, auction, correlationId);
    await this.recordFinalizedEvent(manager, auction, correlationId);
    await this.outboxService.record(manager, {
      eventType: 'AUCTION_PURCHASE_WINDOW_OPENED',
      aggregateType: 'Auction',
      aggregateId: auction.id,
      payload: {
        auctionId: auction.id,
        purchaseWindowEndsAt: purchaseWindowEndsAt.toISOString(),
      },
      correlationId,
    });
    this.metrics.increment('auctions_won_total');
    this.logger.log(
      `[${correlationId}] auction ${auction.id} finalized winnerId=${auction.winnerId} amount=${auction.currentPrice}`,
    );

    return {
      touched: true,
      productId: auction.productId,
      schedulePurchaseWindowExpiry: purchaseWindowEndsAt,
    };
  }

  // ---------------------------------------------------------------------
  // Purchase window expiry: AWAITING_PAYMENT -> EXPIRED
  // ---------------------------------------------------------------------

  async expirePurchaseWindow(
    auctionId: string,
    correlationId: string,
  ): Promise<void> {
    const outcome = await this.auctionsRepository.manager.transaction(
      (manager) => this.runExpireTransaction(manager, auctionId, correlationId),
    );
    if (outcome.touched && outcome.productId) {
      await this.cache.invalidateProduct(outcome.productId);
      await this.cache.invalidateSearch();
    }
  }

  private async runExpireTransaction(
    manager: EntityManager,
    auctionId: string,
    correlationId: string,
  ): Promise<ExpireOutcome> {
    const auction = await manager.findOne(Auction, {
      where: { id: auctionId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!auction) {
      this.logger.warn(
        `[${correlationId}] purchase window expiry found no auction id=${auctionId}, skipping`,
      );
      return { touched: false, productId: null };
    }
    if (auction.status !== AuctionStatus.AWAITING_PAYMENT) {
      // Already purchased, already expired, or the window doesn't apply
      // anymore — idempotent no-op (this is exactly what prevents a
      // redelivered expiry job from racing a just-completed winner
      // checkout).
      return { touched: false, productId: auction.productId };
    }
    if (
      !auction.purchaseWindowEndsAt ||
      Date.now() < auction.purchaseWindowEndsAt.getTime()
    ) {
      return { touched: false, productId: auction.productId };
    }

    assertValidAuctionTransition(auction.status, AuctionStatus.EXPIRED);
    auction.status = AuctionStatus.EXPIRED;
    await manager.save(auction);

    await this.outboxService.record(manager, {
      eventType: 'AUCTION_PURCHASE_WINDOW_EXPIRED',
      aggregateType: 'Auction',
      aggregateId: auction.id,
      payload: {
        auctionId: auction.id,
        productId: auction.productId,
        winnerId: auction.winnerId,
      },
      correlationId,
    });
    await this.recordProductProjectionEvent(manager, auction, correlationId);
    this.metrics.increment('auction_purchase_windows_expired_total');
    this.logger.log(
      `[${correlationId}] auction ${auction.id} purchase window expired unused -> EXPIRED`,
    );
    return { touched: true, productId: auction.productId };
  }

  // ---------------------------------------------------------------------
  // Cancel: SCHEDULED/ACTIVE -> CANCELLED (seller or admin)
  // ---------------------------------------------------------------------

  async cancel(
    actor: AuctionLifecycleActor,
    auctionId: string,
    correlationId: string,
  ): Promise<Auction> {
    const outcome = await this.auctionsRepository.manager.transaction(
      (manager) =>
        this.runCancelTransaction(manager, actor, auctionId, correlationId),
    );
    await this.cancelScheduledFinalization(auctionId);
    if (outcome.touched) {
      await this.cache.invalidateProduct(outcome.auction.productId);
      await this.cache.invalidateSearch();
    }
    return outcome.auction;
  }

  private async runCancelTransaction(
    manager: EntityManager,
    actor: AuctionLifecycleActor,
    auctionId: string,
    correlationId: string,
  ): Promise<CancelOutcome> {
    const auction = await this.lockOwnedAuction(manager, actor, auctionId);

    if (auction.status === AuctionStatus.CANCELLED) {
      return { auction, touched: false };
    }
    assertAuctionCancellable(auction.status);

    auction.status = AuctionStatus.CANCELLED;
    await manager.save(auction);

    await this.outboxService.record(manager, {
      eventType: 'AUCTION_CANCELLED',
      aggregateType: 'Auction',
      aggregateId: auction.id,
      payload: { auctionId: auction.id, productId: auction.productId },
      correlationId,
    });
    await this.recordProductProjectionEvent(manager, auction, correlationId);
    this.metrics.increment('auctions_cancelled_total');
    this.logger.log(`[${correlationId}] auction ${auction.id} cancelled`);

    return { auction, touched: true };
  }

  private async recordProductProjectionEvent(
    manager: EntityManager,
    auction: Auction,
    correlationId: string,
  ): Promise<void> {
    await this.outboxService.record(manager, {
      eventType: 'PRODUCT_UPDATED',
      aggregateType: 'Product',
      aggregateId: auction.productId,
      payload: { productId: auction.productId, auctionId: auction.id },
      correlationId,
    });
  }

  private async recordFinalizedEvent(
    manager: EntityManager,
    auction: Auction,
    correlationId: string,
  ): Promise<void> {
    await this.outboxService.record(manager, {
      eventType: 'AUCTION_FINALIZED',
      aggregateType: 'Auction',
      aggregateId: auction.id,
      payload: { auctionId: auction.id, status: auction.status },
      correlationId,
    });
  }

  /** Scoped ownership check, IDOR-safe: a seller who doesn't own the
   * Auction's Product gets 404, not 403 (see README "Ownership"). */
  async lockOwnedAuction(
    manager: EntityManager,
    actor: AuctionLifecycleActor,
    auctionId: string,
  ): Promise<Auction> {
    const auction = await manager.findOne(Auction, {
      where: { id: auctionId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!auction) {
      throw new NotFoundException(`Auction ${auctionId} not found`);
    }
    if (actor.type === 'seller') {
      const owns = await manager.exists(Product, {
        where: {
          id: auction.productId,
          sellerProfileId: actor.sellerProfileId,
        },
      });
      if (!owns) {
        throw new NotFoundException(`Auction ${auctionId} not found`);
      }
    }
    return auction;
  }
}
