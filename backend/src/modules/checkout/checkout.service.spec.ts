/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- fakeManager is an untyped jest.fn() mock of EntityManager */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CheckoutService } from './checkout.service';
import { Order } from '../orders/entities/order.entity';
import { CheckoutIdempotencyStatus } from '../orders/entities/checkout-idempotency-status.enum';
import { ProductType } from '../products/entities/product-type.enum';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';

function fakeQueryBuilder(affected: number) {
  const qb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected }),
  };
  return qb;
}

function cartItemFixture(overrides: Record<string, unknown> = {}) {
  return {
    productId: 'product-1',
    quantity: 1,
    product: {
      id: 'product-1',
      name: 'Widget',
      price: '10.00',
      isPublished: true,
      type: ProductType.FIXED_PRICE,
      sellerProfileId: 'seller-1',
      sellerProfile: {
        id: 'seller-1',
        storeName: 'Store',
        commissionRatePercent: '10.00',
      },
    },
    ...overrides,
  };
}

describe('CheckoutService', () => {
  let service: CheckoutService;
  let ordersRepository: { manager: any; findOne: jest.Mock };
  let outboxService: { record: jest.Mock };
  let cache: { invalidateProduct: jest.Mock; invalidateSearch: jest.Mock };
  let metrics: { increment: jest.Mock };
  let fakeManager: any;
  let stockAffected: number;

  beforeEach(async () => {
    stockAffected = 1;
    fakeManager = {
      insert: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((x: unknown) => Promise.resolve(x)),
      create: jest.fn((_entity: unknown, data: unknown) => ({
        id: 'generated-id',
        ...(data as object),
      })),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => fakeQueryBuilder(stockAffected)),
    };
    ordersRepository = {
      manager: {
        transaction: jest.fn((cb: (m: unknown) => unknown) => cb(fakeManager)),
        getRepository: jest.fn(),
      },
      findOne: jest.fn(),
    };
    outboxService = { record: jest.fn() };
    cache = { invalidateProduct: jest.fn(), invalidateSearch: jest.fn() };
    metrics = { increment: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: getRepositoryToken(Order), useValue: ordersRepository },
        { provide: OutboxService, useValue: outboxService },
        { provide: CatalogCacheService, useValue: cache },
        { provide: MetricsRegistryService, useValue: metrics },
      ],
    }).compile();

    service = moduleRef.get(CheckoutService);
  });

  it('rejects checkout with no Idempotency-Key header', async () => {
    await expect(
      service.checkout('customer-1', undefined, 'corr-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ordersRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it('rejects checkout when the cart has no items', async () => {
    fakeManager.findOne.mockResolvedValue(null); // no Cart row for this customer

    await expect(
      service.checkout('customer-1', 'key-1', 'corr-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(metrics.increment).toHaveBeenCalledWith('checkout_failed_total');
  });

  it('rejects and rolls back on a stock conflict, never creating an Order', async () => {
    fakeManager.findOne.mockResolvedValue({ id: 'cart-1' });
    fakeManager.find.mockResolvedValue([cartItemFixture({ quantity: 5 })]);
    stockAffected = 0; // guarded UPDATE finds insufficient stock

    await expect(
      service.checkout('customer-1', 'key-1', 'corr-1', {}),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(metrics.increment).toHaveBeenCalledWith('stock_conflicts_total');
    expect(metrics.increment).toHaveBeenCalledWith('checkout_failed_total');
    // Order/SellerOrder creation happens after the stock loop — never reached.
    expect(fakeManager.create).not.toHaveBeenCalledWith(
      Order,
      expect.anything(),
    );
  });

  it('rejects an auction product in the cart without touching stock', async () => {
    fakeManager.findOne.mockResolvedValue({ id: 'cart-1' });
    fakeManager.find.mockResolvedValue([
      cartItemFixture({
        product: {
          id: 'product-1',
          name: 'Auction Item',
          price: null,
          isPublished: true,
          type: ProductType.AUCTION,
          sellerProfileId: 'seller-1',
          sellerProfile: {
            id: 'seller-1',
            storeName: 'Store',
            commissionRatePercent: '10.00',
          },
        },
      }),
    ]);

    await expect(
      service.checkout('customer-1', 'key-1', 'corr-1', {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(fakeManager.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('computes commission/net split per seller and writes outbox + ledger entries in-transaction', async () => {
    fakeManager.findOne.mockResolvedValue({ id: 'cart-1' });
    fakeManager.find.mockResolvedValue([
      cartItemFixture({ quantity: 2 }), // 10.00 * 2 = 20.00, 10% commission = 2.00
    ]);

    const result = await service.checkout('customer-1', 'key-1', 'corr-1', {});

    expect(result.totalAmount).toBe('20.00');
    expect(result.sellerOrders).toHaveLength(1);
    expect(result.sellerOrders[0].subtotal).toBe('20.00');
    expect(result.sellerOrders[0].commissionAmount).toBe('2.00');
    expect(result.sellerOrders[0].sellerNetAmount).toBe('18.00');
    expect(result.replayed).toBe(false);

    expect(outboxService.record).toHaveBeenCalledWith(
      fakeManager,
      expect.objectContaining({ eventType: 'ORDER_CREATED' }),
    );
    expect(outboxService.record).toHaveBeenCalledWith(
      fakeManager,
      expect.objectContaining({ eventType: 'SELLER_ORDER_CREATED' }),
    );
    expect(outboxService.record).toHaveBeenCalledWith(
      fakeManager,
      expect.objectContaining({ eventType: 'STOCK_CHANGED' }),
    );
    expect(fakeManager.delete).toHaveBeenCalled(); // cart cleared
    expect(cache.invalidateProduct).toHaveBeenCalledWith('product-1');
    expect(cache.invalidateSearch).toHaveBeenCalled();
    expect(metrics.increment).toHaveBeenCalledWith('checkout_succeeded_total');
  });

  it('replays a completed checkout on a duplicate Idempotency-Key instead of erroring', async () => {
    const uniqueViolationError = Object.assign(new Error('duplicate key'), {
      code: '23505',
    });
    fakeManager.insert.mockRejectedValue(uniqueViolationError);

    const idempotencyKeyRepo = {
      findOne: jest.fn().mockResolvedValue({
        customerId: 'customer-1',
        idempotencyKey: 'key-1',
        status: CheckoutIdempotencyStatus.COMPLETED,
        orderId: 'order-1',
      }),
    };
    ordersRepository.manager.getRepository.mockReturnValue(idempotencyKeyRepo);
    ordersRepository.findOne.mockResolvedValue({
      id: 'order-1',
      status: 'NEW',
      totalAmount: '20.00',
      sellerOrders: [],
    });

    const result = await service.checkout('customer-1', 'key-1', 'corr-1', {});

    expect(result.orderId).toBe('order-1');
    expect(result.replayed).toBe(true);
    expect(metrics.increment).toHaveBeenCalledWith(
      'checkout_idempotent_replays_total',
    );
  });
});
