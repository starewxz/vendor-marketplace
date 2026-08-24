/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- fakeManager is an untyped jest.fn() mock of EntityManager */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BidPlacementService } from './bid-placement.service';
import { Bid } from './entities/bid.entity';
import { Auction } from './entities/auction.entity';
import { AuctionStatus } from './entities/auction-status.enum';
import { Product } from '../products/entities/product.entity';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';

function auctionFixture(overrides: Partial<Auction> = {}): Auction {
  return {
    id: 'auction-1',
    productId: 'product-1',
    startPrice: '10.00',
    currentPrice: '10.00',
    minBidIncrement: '1.00',
    startsAt: new Date(Date.now() - 60_000),
    endsAt: new Date(Date.now() + 60_000),
    winnerId: null,
    purchaseWindowEndsAt: null,
    status: AuctionStatus.ACTIVE,
    version: 1,
    ...overrides,
  } as Auction;
}

function productFixture(overrides: Record<string, unknown> = {}): Product {
  return {
    id: 'product-1',
    sellerProfileId: 'seller-1',
    sellerProfile: { id: 'seller-1', userId: 'seller-user-1' },
    ...overrides,
  } as unknown as Product;
}

describe('BidPlacementService', () => {
  let service: BidPlacementService;
  let bidsRepository: { manager: any; findOne: jest.Mock };
  let outboxService: { record: jest.Mock };
  let cache: { invalidateProduct: jest.Mock; invalidateSearch: jest.Mock };
  let metrics: { increment: jest.Mock };
  let fakeManager: any;
  let auction: Auction;
  let product: Product;

  beforeEach(async () => {
    auction = auctionFixture();
    product = productFixture();

    fakeManager = {
      findOne: jest.fn((entity: unknown) => {
        if (entity === Auction) return Promise.resolve(auction);
        if (entity === Product) return Promise.resolve(product);
        if (entity === Bid) return Promise.resolve(null);
        return Promise.resolve(null);
      }),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
      create: jest.fn((_entity: unknown, data: unknown) => ({
        id: 'bid-generated',
        ...(data as object),
      })),
    };
    bidsRepository = {
      manager: {
        transaction: jest.fn((cb: (m: unknown) => unknown) => cb(fakeManager)),
        findOne: jest.fn(() => Promise.resolve(auction)),
      },
      findOne: jest.fn(),
    };
    outboxService = { record: jest.fn() };
    cache = { invalidateProduct: jest.fn(), invalidateSearch: jest.fn() };
    metrics = { increment: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BidPlacementService,
        { provide: getRepositoryToken(Bid), useValue: bidsRepository },
        { provide: OutboxService, useValue: outboxService },
        { provide: CatalogCacheService, useValue: cache },
        { provide: MetricsRegistryService, useValue: metrics },
      ],
    }).compile();

    service = moduleRef.get(BidPlacementService);
  });

  it('rejects a bid with no Idempotency-Key header', async () => {
    await expect(
      service.placeBid('bidder-1', 'auction-1', undefined, 'corr-1', {
        amount: '11.00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bidsRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it('rejects when the auction does not exist', async () => {
    fakeManager.findOne.mockResolvedValueOnce(null);
    await expect(
      service.placeBid('bidder-1', 'auction-1', 'key-1', 'corr-1', {
        amount: '11.00',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a bid placed after the deadline, even though status is still ACTIVE', async () => {
    auction.endsAt = new Date(Date.now() - 1000); // deadline already passed
    await expect(
      service.placeBid('bidder-1', 'auction-1', 'key-1', 'corr-1', {
        amount: '11.00',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(fakeManager.create).not.toHaveBeenCalled();
  });

  it('rejects a bid before startsAt', async () => {
    auction.status = AuctionStatus.SCHEDULED;
    auction.startsAt = new Date(Date.now() + 60_000);
    await expect(
      service.placeBid('bidder-1', 'auction-1', 'key-1', 'corr-1', {
        amount: '11.00',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('self-heals a SCHEDULED auction into ACTIVE once inside its bidding window', async () => {
    auction.status = AuctionStatus.SCHEDULED;
    auction.startsAt = new Date(Date.now() - 1000);
    await service.placeBid('bidder-1', 'auction-1', 'key-1', 'corr-1', {
      amount: '10.00',
    });
    expect(fakeManager.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: AuctionStatus.ACTIVE }),
    );
  });

  it("rejects a bid from the auction's own seller", async () => {
    await expect(
      service.placeBid('seller-user-1', 'auction-1', 'key-1', 'corr-1', {
        amount: '11.00',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepts the first bid at the start price', async () => {
    const result = await service.placeBid(
      'bidder-1',
      'auction-1',
      'key-1',
      'corr-1',
      { amount: '10.00' },
    );
    expect(result).toMatchObject({ amount: '10.00' });
  });

  it('rejects a later bid below currentPrice + minBidIncrement', async () => {
    auction.winnerId = 'prior-bidder';
    await expect(
      service.placeBid('bidder-1', 'auction-1', 'key-1', 'corr-1', {
        amount: '10.50',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a bid exactly equal to currentPrice + minBidIncrement minus one cent', async () => {
    auction.winnerId = 'prior-bidder';
    await expect(
      service.placeBid('bidder-1', 'auction-1', 'key-1', 'corr-1', {
        amount: '10.99',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepts a bid exactly at the minimum next bid and advances currentPrice', async () => {
    auction.winnerId = 'prior-bidder';
    const bid = await service.placeBid(
      'bidder-1',
      'auction-1',
      'key-1',
      'corr-1',
      {
        amount: '11.00',
      },
    );

    expect(bid).toMatchObject({ amount: '11.00', currentPrice: '11.00' });
    expect(fakeManager.save).toHaveBeenCalledWith(
      expect.objectContaining({ currentPrice: '11.00' }),
    );
    expect(outboxService.record).toHaveBeenCalledWith(
      fakeManager,
      expect.objectContaining({
        eventType: 'BID_PLACED',
        aggregateType: 'Auction',
      }),
    );
    expect(cache.invalidateProduct).toHaveBeenCalledWith('product-1');
    expect(cache.invalidateSearch).toHaveBeenCalled();
    expect(metrics.increment).toHaveBeenCalledWith('bids_placed_total');
  });

  it('rejects a second bid at the same value once the first has already advanced currentPrice', async () => {
    // Simulates the second of two concurrent equal-value bids: by the time
    // it acquires the lock, currentPrice already reflects the first bid.
    auction.currentPrice = '11.00';
    auction.winnerId = 'bidder-1';
    await expect(
      service.placeBid('bidder-2', 'auction-1', 'key-2', 'corr-1', {
        amount: '11.00',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('replays an idempotent retry instead of creating a second bid', async () => {
    const uniqueViolationError = Object.assign(new Error('duplicate key'), {
      code: '23505',
    });
    fakeManager.save.mockImplementationOnce(() =>
      Promise.reject(uniqueViolationError),
    );

    const existingBid = {
      id: 'bid-existing',
      auctionId: 'auction-1',
      amount: '11.00',
      bidderId: 'bidder-1',
      createdAt: new Date(),
    };
    bidsRepository.findOne.mockResolvedValue(existingBid);

    const result = await service.placeBid(
      'bidder-1',
      'auction-1',
      'key-1',
      'corr-1',
      {
        amount: '11.00',
      },
    );

    expect(result).toMatchObject({ bidId: 'bid-existing', amount: '11.00' });
    expect(metrics.increment).toHaveBeenCalledWith(
      'bid_idempotent_replays_total',
    );
  });
});
