/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- fakeManager is an untyped jest.fn() mock of EntityManager */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken as getTypeOrmRepositoryToken } from '@nestjs/typeorm';
import { AuctionLifecycleService } from './auction-lifecycle.service';
import { Auction } from './entities/auction.entity';
import { AuctionStatus } from './entities/auction-status.enum';
import { Bid } from './entities/bid.entity';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { ConfigService } from '@nestjs/config';

function auctionFixture(overrides: Partial<Auction> = {}): Auction {
  return {
    id: 'auction-1',
    productId: 'product-1',
    startPrice: '10.00',
    currentPrice: '10.00',
    minBidIncrement: '1.00',
    startsAt: new Date(Date.now() - 120_000),
    endsAt: new Date(Date.now() - 1000),
    winnerId: null,
    purchaseWindowEndsAt: null,
    status: AuctionStatus.ACTIVE,
    version: 1,
    ...overrides,
  } as Auction;
}

describe('AuctionLifecycleService', () => {
  let service: AuctionLifecycleService;
  let auctionsRepository: { manager: any };
  let outboxService: { record: jest.Mock };
  let cache: { invalidateProduct: jest.Mock; invalidateSearch: jest.Mock };
  let metrics: { increment: jest.Mock };
  let queue: { add: jest.Mock; getJob: jest.Mock };
  let fakeManager: any;
  let auction: Auction;

  beforeEach(async () => {
    auction = auctionFixture();

    fakeManager = {
      findOne: jest.fn((entity: unknown) => {
        if (entity === Auction) return Promise.resolve(auction);
        if (entity === Bid) return Promise.resolve(null);
        return Promise.resolve(null);
      }),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
      exists: jest.fn().mockResolvedValue(true),
    };
    auctionsRepository = {
      manager: {
        transaction: jest.fn((cb: (m: unknown) => unknown) => cb(fakeManager)),
      },
    };
    outboxService = { record: jest.fn() };
    cache = { invalidateProduct: jest.fn(), invalidateSearch: jest.fn() };
    metrics = { increment: jest.fn() };
    queue = {
      add: jest.fn().mockResolvedValue(undefined),
      getJob: jest.fn().mockResolvedValue(null),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuctionLifecycleService,
        {
          provide: getTypeOrmRepositoryToken(Auction),
          useValue: auctionsRepository,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.AUCTION_FINALIZATION),
          useValue: queue,
        },
        { provide: OutboxService, useValue: outboxService },
        { provide: CatalogCacheService, useValue: cache },
        { provide: MetricsRegistryService, useValue: metrics },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, fallback: number) => fallback),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuctionLifecycleService);
  });

  describe('finalizeAuction', () => {
    it('ends an auction with no bids as UNSOLD, without scheduling a purchase window', async () => {
      await service.finalizeAuction('auction-1', 'corr-1');

      expect(fakeManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AuctionStatus.UNSOLD }),
      );
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({ eventType: 'AUCTION_UNSOLD' }),
      );
      expect(metrics.increment).toHaveBeenCalledWith('auctions_unsold_total');
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('finalizes a zero-bid SCHEDULED auction once its deadline has passed', async () => {
      auction.status = AuctionStatus.SCHEDULED;

      await service.finalizeAuction('auction-1', 'corr-1');

      expect(fakeManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AuctionStatus.UNSOLD }),
      );
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({ eventType: 'AUCTION_UNSOLD' }),
      );
    });

    it('sets a winner from the highest bid and opens a purchase window', async () => {
      fakeManager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Auction) return Promise.resolve(auction);
        if (entity === Bid) {
          return Promise.resolve({
            id: 'bid-1',
            bidderId: 'bidder-1',
            amount: '25.00',
          });
        }
        return Promise.resolve(null);
      });

      await service.finalizeAuction('auction-1', 'corr-1');

      expect(fakeManager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AuctionStatus.AWAITING_PAYMENT,
          winnerId: 'bidder-1',
          currentPrice: '25.00',
        }),
      );
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({ eventType: 'AUCTION_WON' }),
      );
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({
          eventType: 'AUCTION_PURCHASE_WINDOW_OPENED',
        }),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'EXPIRE_PURCHASE_WINDOW',
        expect.objectContaining({ auctionId: 'auction-1' }),
        expect.objectContaining({ jobId: 'auction-expire:auction-1' }),
      );
    });

    it('is an idempotent no-op when the auction is no longer ACTIVE', async () => {
      auction.status = AuctionStatus.UNSOLD;
      await service.finalizeAuction('auction-1', 'corr-1');
      expect(fakeManager.save).not.toHaveBeenCalled();
      expect(outboxService.record).not.toHaveBeenCalled();
    });

    it('is a defensive no-op if called before endsAt has actually passed', async () => {
      auction.endsAt = new Date(Date.now() + 60_000);
      await service.finalizeAuction('auction-1', 'corr-1');
      expect(fakeManager.save).not.toHaveBeenCalled();
    });
  });

  describe('expirePurchaseWindow', () => {
    beforeEach(() => {
      auction.status = AuctionStatus.AWAITING_PAYMENT;
      auction.winnerId = 'bidder-1';
      auction.purchaseWindowEndsAt = new Date(Date.now() - 1000);
    });

    it('expires an unused purchase window to EXPIRED', async () => {
      await service.expirePurchaseWindow('auction-1', 'corr-1');
      expect(fakeManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AuctionStatus.EXPIRED }),
      );
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({
          eventType: 'AUCTION_PURCHASE_WINDOW_EXPIRED',
        }),
      );
    });

    it('is an idempotent no-op once the auction is already COMPLETED (winner already checked out)', async () => {
      auction.status = AuctionStatus.COMPLETED;
      await service.expirePurchaseWindow('auction-1', 'corr-1');
      expect(fakeManager.save).not.toHaveBeenCalled();
    });

    it('is a no-op if the window has not actually expired yet', async () => {
      auction.purchaseWindowEndsAt = new Date(Date.now() + 60_000);
      await service.expirePurchaseWindow('auction-1', 'corr-1');
      expect(fakeManager.save).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('cancels a SCHEDULED/ACTIVE auction and removes any scheduled jobs', async () => {
      await service.cancel({ type: 'admin' }, 'auction-1', 'corr-1');
      expect(fakeManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: AuctionStatus.CANCELLED }),
      );
      expect(queue.getJob).toHaveBeenCalledWith('auction-finalize:auction-1');
      expect(queue.getJob).toHaveBeenCalledWith('auction-expire:auction-1');
    });

    it('is an idempotent no-op when already CANCELLED', async () => {
      auction.status = AuctionStatus.CANCELLED;
      const result = await service.cancel(
        { type: 'admin' },
        'auction-1',
        'corr-1',
      );
      expect(result.status).toBe(AuctionStatus.CANCELLED);
      expect(outboxService.record).not.toHaveBeenCalled();
    });

    it('rejects cancelling once a winner is already awaiting payment', async () => {
      auction.status = AuctionStatus.AWAITING_PAYMENT;
      await expect(
        service.cancel({ type: 'admin' }, 'auction-1', 'corr-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('is IDOR-safe: a seller who does not own the product gets 404, not 403', async () => {
      fakeManager.exists.mockResolvedValue(false);
      await expect(
        service.cancel(
          { type: 'seller', sellerProfileId: 'not-owner' },
          'auction-1',
          'corr-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
