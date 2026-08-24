import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Interval } from '@nestjs/schedule';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { AuctionStatus } from './entities/auction-status.enum';
import { AuctionLifecycleService } from './auction-lifecycle.service';

const RECONCILIATION_INTERVAL_MS = 10_000;
const BATCH_SIZE = 50;

/**
 * Reliability backstop for AuctionLifecycleService's BullMQ delayed jobs —
 * mirrors OutboxPublisherService's @Interval poll shape. A delayed job can
 * fail to schedule (a Redis blip at the moment of creation/update) or, more
 * routinely, is redundant with this sweep by design rather than by
 * accident: both call the same idempotent finalizeAuction/
 * expirePurchaseWindow methods, so whichever gets there first wins and the
 * other is a no-op.
 */
@Injectable()
export class AuctionReconciliationService {
  private readonly logger = new Logger(AuctionReconciliationService.name);
  private isRunning = false;

  constructor(
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
    private readonly lifecycle: AuctionLifecycleService,
  ) {}

  @Interval(RECONCILIATION_INTERVAL_MS)
  async reconcile(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.reconcileOverdueFinalizations();
      await this.reconcileExpiredPurchaseWindows();
    } catch (error) {
      this.logger.error(
        `auction reconciliation sweep failed: ${(error as Error).message}`,
      );
    } finally {
      this.isRunning = false;
    }
  }

  private async reconcileOverdueFinalizations(): Promise<void> {
    const overdue = await this.auctionsRepository.find({
      where: {
        status: In([AuctionStatus.SCHEDULED, AuctionStatus.ACTIVE]),
        endsAt: LessThanOrEqual(new Date()),
      },
      take: BATCH_SIZE,
    });
    for (const auction of overdue) {
      const correlationId = randomUUID();
      this.logger.log(
        `[${correlationId}] reconciliation finalizing overdue auction ${auction.id}`,
      );
      await this.lifecycle.finalizeAuction(auction.id, correlationId);
    }
  }

  private async reconcileExpiredPurchaseWindows(): Promise<void> {
    const overdue = await this.auctionsRepository.find({
      where: {
        status: AuctionStatus.AWAITING_PAYMENT,
        purchaseWindowEndsAt: LessThanOrEqual(new Date()),
      },
      take: BATCH_SIZE,
    });
    for (const auction of overdue) {
      const correlationId = randomUUID();
      this.logger.log(
        `[${correlationId}] reconciliation expiring purchase window for auction ${auction.id}`,
      );
      await this.lifecycle.expirePurchaseWindow(auction.id, correlationId);
    }
  }
}
