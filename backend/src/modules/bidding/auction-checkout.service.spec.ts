/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- fakeManager is an untyped jest.fn() mock of EntityManager */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuctionCheckoutService } from './auction-checkout.service';
import { Auction } from './entities/auction.entity';
import { AuctionStatus } from './entities/auction-status.enum';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';
import { CheckoutIdempotencyStatus } from '../orders/entities/checkout-idempotency-status.enum';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';

function auctionFixture(overrides: Partial<Auction> = {}): Auction {
  return {
    id: 'auction-1',
    productId: 'product-1',
    startPrice: '10.00',
    currentPrice: '25.00',
    minBidIncrement: '1.00',
    startsAt: new Date(Date.now() - 120_000),
    endsAt: new Date(Date.now() - 60_000),
    winnerId: 'winner-1',
    purchaseWindowEndsAt: new Date(Date.now() + 60_000),
    status: AuctionStatus.AWAITING_PAYMENT,
    version: 1,
    ...overrides,
  } as Auction;
}

function productFixture(overrides: Record<string, unknown> = {}): Product {
  return {
    id: 'product-1',
    name: 'Vintage Lamp',
    sellerProfileId: 'seller-1',
    sellerProfile: { id: 'seller-1', commissionRatePercent: '10.00' },
    ...overrides,
  } as unknown as Product;
}

function fakeQueryBuilder(affected: number) {
  return {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected }),
  };
}

describe('AuctionCheckoutService', () => {
  let service: AuctionCheckoutService;
  let auctionsRepository: { manager: any };
  let outboxService: { record: jest.Mock };
  let cache: { invalidateProduct: jest.Mock; invalidateSearch: jest.Mock };
  let metrics: { increment: jest.Mock };
  let fakeManager: any;
  let auction: Auction;
  let product: Product;
  let stockAffected: number;

  beforeEach(async () => {
    auction = auctionFixture();
    product = productFixture();
    stockAffected = 1;

    fakeManager = {
      insert: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn((entity: unknown) => {
        if (entity === Auction) return Promise.resolve(auction);
        if (entity === Product) return Promise.resolve(product);
        return Promise.resolve(null);
      }),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
      create: jest.fn((_entity: unknown, data: unknown) => ({
        id: 'generated-id',
        ...(data as object),
      })),
      update: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => fakeQueryBuilder(stockAffected)),
      getRepository: jest.fn(),
    };
    auctionsRepository = {
      manager: {
        transaction: jest.fn((cb: (m: unknown) => unknown) => cb(fakeManager)),
        getRepository: jest.fn(),
      },
    };
    outboxService = { record: jest.fn() };
    cache = { invalidateProduct: jest.fn(), invalidateSearch: jest.fn() };
    metrics = { increment: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuctionCheckoutService,
        { provide: getRepositoryToken(Auction), useValue: auctionsRepository },
        { provide: OutboxService, useValue: outboxService },
        { provide: CatalogCacheService, useValue: cache },
        { provide: MetricsRegistryService, useValue: metrics },
      ],
    }).compile();

    service = moduleRef.get(AuctionCheckoutService);
  });

  it('rejects checkout with no Idempotency-Key header', async () => {
    await expect(
      service.checkout('winner-1', 'auction-1', undefined, 'corr-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a caller who is not the auction winner', async () => {
    await expect(
      service.checkout('someone-else', 'auction-1', 'key-1', 'corr-1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fakeManager.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects checkout once the purchase window has expired', async () => {
    auction.purchaseWindowEndsAt = new Date(Date.now() - 1000);
    await expect(
      service.checkout('winner-1', 'auction-1', 'key-1', 'corr-1', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects checkout when the auction is not AWAITING_PAYMENT', async () => {
    auction.status = AuctionStatus.COMPLETED;
    await expect(
      service.checkout('winner-1', 'auction-1', 'key-1', 'corr-1', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates an Order/SellerOrder priced at the winning bid, decrements stock once, and completes the auction', async () => {
    const result = await service.checkout(
      'winner-1',
      'auction-1',
      'key-1',
      'corr-1',
      {},
    );

    expect(result.totalAmount).toBe('25.00');
    expect(result.replayed).toBe(false);
    expect(fakeManager.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(fakeManager.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: AuctionStatus.COMPLETED }),
    );
    expect(fakeManager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: '25.00',
        commissionAmount: '2.50',
        sellerNetAmount: '22.50',
      }),
    );
    expect(outboxService.record).toHaveBeenCalledWith(
      fakeManager,
      expect.objectContaining({ eventType: 'AUCTION_PURCHASED' }),
    );
    expect(outboxService.record).toHaveBeenCalledWith(
      fakeManager,
      expect.objectContaining({ eventType: 'ORDER_CREATED' }),
    );
    expect(cache.invalidateProduct).toHaveBeenCalledWith('product-1');
    expect(metrics.increment).toHaveBeenCalledWith(
      'auction_checkout_succeeded_total',
    );
  });

  it('rejects when the guarded stock decrement finds nothing to decrement', async () => {
    stockAffected = 0;
    await expect(
      service.checkout('winner-1', 'auction-1', 'key-1', 'corr-1', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('replays a completed checkout on a duplicate Idempotency-Key instead of double-charging', async () => {
    const uniqueViolationError = Object.assign(new Error('duplicate key'), {
      code: '23505',
    });
    fakeManager.insert.mockRejectedValue(uniqueViolationError);

    const idempotencyKeyRepo = {
      findOne: jest.fn().mockResolvedValue({
        customerId: 'winner-1',
        idempotencyKey: 'key-1',
        status: CheckoutIdempotencyStatus.COMPLETED,
        orderId: 'order-1',
      }),
    };
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'order-1',
        status: 'NEW',
        totalAmount: '25.00',
        sellerOrders: [{ id: 'seller-order-1' }],
      }),
    };
    auctionsRepository.manager.getRepository.mockImplementation(
      (entity: unknown) => {
        if (entity === Order) return orderRepo;
        return idempotencyKeyRepo;
      },
    );

    const result = await service.checkout(
      'winner-1',
      'auction-1',
      'key-1',
      'corr-1',
      {},
    );

    expect(result.orderId).toBe('order-1');
    expect(result.replayed).toBe(true);
    expect(metrics.increment).toHaveBeenCalledWith(
      'auction_checkout_idempotent_replays_total',
    );
  });
});
