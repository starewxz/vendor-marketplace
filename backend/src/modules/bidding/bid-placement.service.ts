import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Auction } from './entities/auction.entity';
import { AuctionStatus } from './entities/auction-status.enum';
import { Bid } from './entities/bid.entity';
import { Product } from '../products/entities/product.entity';
import { isWithinBiddingWindow } from './domain/auction-status.policy';
import { PlaceBidDto } from './dto/place-bid.dto';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { isUniqueViolation } from '../../common/utils/slug';
import {
  formatCentsToMoney,
  parseMoneyToCents,
  sumCents,
} from '../../common/utils/money';
import { BidAcceptedView } from './dto/auction-public-view';

const IDEMPOTENCY_KEY_MAX_LENGTH = 200;

interface BidOutcome {
  bid: Bid;
  productId: string;
}

/**
 * The single write path for placing a bid. Every concurrent bid against the
 * same auction serializes on one `SELECT ... FOR UPDATE` of the Auction
 * row — the second of two racing requests blocks until the first commits,
 * then re-reads the just-committed currentPrice before validating its own
 * amount, so a lost update (both bids reading the same stale currentPrice
 * and both succeeding) is structurally impossible. The end-of-auction
 * deadline check happens on that same locked, freshly-read row, which is
 * what makes a last-second bid and the finalize job's own lock acquisition
 * mutually exclusive — see AuctionLifecycleService.finalizeAuction.
 */
@Injectable()
export class BidPlacementService {
  private readonly logger = new Logger(BidPlacementService.name);

  constructor(
    @InjectRepository(Bid)
    private readonly bidsRepository: Repository<Bid>,
    private readonly outboxService: OutboxService,
    private readonly cache: CatalogCacheService,
    private readonly metrics: MetricsRegistryService,
  ) {}

  async placeBid(
    bidderId: string,
    auctionId: string,
    idempotencyKey: string | undefined,
    correlationId: string,
    dto: PlaceBidDto,
  ): Promise<BidAcceptedView> {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new BadRequestException('Idempotency-Key header is too long');
    }

    this.metrics.increment('bid_attempts_total');

    try {
      const outcome = await this.bidsRepository.manager.transaction((manager) =>
        this.runBidTransaction(
          manager,
          bidderId,
          auctionId,
          idempotencyKey,
          correlationId,
          dto,
        ),
      );

      // Best-effort, post-commit only — see CheckoutService for the same
      // pattern and reasoning.
      await this.cache.invalidateProduct(outcome.productId);
      await this.cache.invalidateSearch();

      this.metrics.increment('bids_placed_total');
      return this.toView(outcome.bid, auctionId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.log(
          `[${correlationId}] bid idempotent replay auctionId=${auctionId} bidderId=${bidderId}`,
        );
        this.metrics.increment('bid_idempotent_replays_total');
        const replayed = await this.replayBid(
          auctionId,
          bidderId,
          idempotencyKey,
        );
        return this.toView(replayed, auctionId);
      }
      if (error instanceof ConflictException) {
        this.metrics.increment('bid_conflicts_total');
        this.metrics.increment('bids_rejected_total');
      }
      throw error;
    }
  }

  private async runBidTransaction(
    manager: EntityManager,
    bidderId: string,
    auctionId: string,
    idempotencyKey: string,
    correlationId: string,
    dto: PlaceBidDto,
  ): Promise<BidOutcome> {
    // 1. Acquire the row lock — every other concurrent bid, and the
    // finalize job, block here until this transaction commits or rolls
    // back.
    const auction = await manager.findOne(Auction, {
      where: { id: auctionId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!auction) {
      throw new NotFoundException(`Auction ${auctionId} not found`);
    }

    // The Auction lock serializes duplicate submissions too. A retry must
    // be recognized before current-price validation: the original request
    // has already advanced that price, so validating first would turn a
    // legitimate replay into a false "bid too low" conflict.
    const replay = await manager.findOne(Bid, {
      where: { auctionId, bidderId, idempotencyKey },
    });
    if (replay) {
      if (replay.amount !== dto.amount) {
        throw new ConflictException(
          'This Idempotency-Key was already used for a different bid amount',
        );
      }
      return { bid: replay, productId: auction.productId };
    }

    const now = new Date();

    // 2. Self-heal SCHEDULED -> ACTIVE if the bidding window has opened
    // since the last time anything observed this row — correctness never
    // depends on a separate "start" job having already run.
    const activatedNow =
      auction.status === AuctionStatus.SCHEDULED &&
      isWithinBiddingWindow(auction.startsAt, auction.endsAt, now);
    if (activatedNow) {
      auction.status = AuctionStatus.ACTIVE;
    }

    // 3. The deadline check — evaluated on the just-locked, just-read row,
    // not on a value read before the lock. This is what prevents a bid
    // arriving in the auction's final instant from landing after (or
    // racing) finalization: both paths lock the same row, so whichever
    // acquires it first fully decides the outcome before the other proceeds.
    if (
      auction.status !== AuctionStatus.ACTIVE ||
      now.getTime() < auction.startsAt.getTime() ||
      now.getTime() >= auction.endsAt.getTime()
    ) {
      throw new ConflictException(
        'This auction is not currently open for bidding',
      );
    }

    // 4. A seller cannot bid on their own auction.
    const product = await manager.findOne(Product, {
      where: { id: auction.productId },
      relations: { sellerProfile: true },
    });
    if (!product) {
      throw new NotFoundException(`Product ${auction.productId} not found`);
    }
    if (product.sellerProfile.userId === bidderId) {
      throw new ConflictException('You cannot bid on your own auction');
    }

    // 5. The first bid may equal startPrice. Every later bid must meet
    // currentPrice + minBidIncrement. Two concurrent equal-value first bids
    // still serialize: the second lock holder sees the first as currentPrice
    // and therefore fails the increment rule.
    const hasBid = auction.winnerId !== null;
    const minNextBidCents = hasBid
      ? sumCents([
          parseMoneyToCents(auction.currentPrice),
          parseMoneyToCents(auction.minBidIncrement),
        ])
      : parseMoneyToCents(auction.startPrice);
    const amountCents = parseMoneyToCents(dto.amount);
    if (amountCents < minNextBidCents) {
      throw new ConflictException(
        `Bid must be at least ${formatCentsToMoney(minNextBidCents)}`,
      );
    }

    // 6. Insert the append-only Bid row — also the idempotency claim (see
    // Bid's unique index on (auctionId, bidderId, idempotencyKey)).
    const bid = await manager.save(
      manager.create(Bid, {
        auctionId,
        bidderId,
        amount: dto.amount,
        idempotencyKey,
      }),
    );

    // 7. Advance the auction's leading price.
    auction.currentPrice = dto.amount;
    auction.winnerId = bidderId;
    auction.winningBidId = bid.id;
    await manager.save(auction);

    if (activatedNow) {
      await this.outboxService.record(manager, {
        eventType: 'AUCTION_STARTED',
        aggregateType: 'Auction',
        aggregateId: auction.id,
        payload: { auctionId: auction.id, productId: auction.productId },
        correlationId,
      });
    }

    // 8. Outbox event, same transaction — never published to BullMQ/Redis
    // until after commit (see OutboxPublisherService).
    await this.outboxService.record(manager, {
      eventType: 'BID_PLACED',
      aggregateType: 'Auction',
      aggregateId: auction.id,
      payload: {
        auctionId: auction.id,
        bidId: bid.id,
        bidderId,
        amount: dto.amount,
      },
      correlationId,
    });
    await this.outboxService.record(manager, {
      eventType: 'PRODUCT_UPDATED',
      aggregateType: 'Product',
      aggregateId: auction.productId,
      payload: { productId: auction.productId, auctionId: auction.id },
      correlationId,
    });

    this.logger.log(
      `[${correlationId}] bid placed auctionId=${auction.id} bidderId=${bidderId} amount=${dto.amount}`,
    );

    return { bid, productId: auction.productId };
  }

  private async replayBid(
    auctionId: string,
    bidderId: string,
    idempotencyKey: string,
  ): Promise<Bid> {
    const existing = await this.bidsRepository.findOne({
      where: { auctionId, bidderId, idempotencyKey },
    });
    if (!existing) {
      throw new ConflictException(
        'A bid with this Idempotency-Key is already in progress',
      );
    }
    return existing;
  }

  private async toView(bid: Bid, auctionId: string): Promise<BidAcceptedView> {
    const auction = await this.bidsRepository.manager.findOne(Auction, {
      where: { id: auctionId },
    });
    if (!auction) {
      throw new NotFoundException(`Auction ${auctionId} not found`);
    }
    const next = sumCents([
      parseMoneyToCents(auction.currentPrice),
      parseMoneyToCents(auction.minBidIncrement),
    ]);
    return {
      bidId: bid.id,
      auctionId: bid.auctionId,
      amount: bid.amount,
      currentPrice: auction.currentPrice,
      minimumNextBid: formatCentsToMoney(next),
      createdAt: bid.createdAt,
    };
  }
}
