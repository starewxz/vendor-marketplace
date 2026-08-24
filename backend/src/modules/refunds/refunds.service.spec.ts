/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return -- fakeManager is an untyped jest.fn() mock of EntityManager */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefundsService } from './refunds.service';
import { Refund } from './entities/refund.entity';
import { RefundStatus } from './entities/refund-status.enum';
import { SellerOrder } from '../orders/entities/seller-order.entity';
import { SellerOrderItem } from '../orders/entities/seller-order-item.entity';
import { SellerOrderStatus } from '../orders/entities/seller-order-status.enum';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';

function sellerOrderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'so-1',
    sellerProfileId: 'seller-1',
    status: SellerOrderStatus.DELIVERED,
    subtotal: '200.00',
    commissionAmount: '20.00',
    sellerNetAmount: '180.00',
    ...overrides,
  };
}

function itemFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    sellerOrderId: 'so-1',
    productId: 'product-1',
    productName: 'Widget',
    unitPrice: '100.00',
    quantity: 2,
    lineTotal: '200.00',
    ...overrides,
  };
}

describe('RefundsService', () => {
  let service: RefundsService;
  let refundsRepository: { manager: any; findOne: jest.Mock; find: jest.Mock };
  let outboxService: { record: jest.Mock };
  let cache: { invalidateProduct: jest.Mock; invalidateSearch: jest.Mock };
  let metrics: { increment: jest.Mock };
  let fakeManager: any;
  let sellerOrder: ReturnType<typeof sellerOrderFixture>;
  let item: ReturnType<typeof itemFixture>;
  let priorRefunds: any[];

  beforeEach(async () => {
    sellerOrder = sellerOrderFixture();
    item = itemFixture();
    priorRefunds = [];

    fakeManager = {
      findOne: jest.fn((entity: unknown, opts: any) => {
        if (entity === SellerOrder) return Promise.resolve(sellerOrder);
        if (entity === SellerOrderItem) {
          return Promise.resolve(opts.where.id === item.id ? item : null);
        }
        return Promise.resolve(null);
      }),
      find: jest.fn((entity: unknown) => {
        if (entity === Refund) return Promise.resolve(priorRefunds);
        return Promise.resolve([]);
      }),
      save: jest.fn((entity: any) =>
        Promise.resolve({ id: 'refund-1', ...entity }),
      ),
      create: jest.fn((_entity: unknown, data: unknown) => ({
        ...(data as object),
      })),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    };
    refundsRepository = {
      manager: {
        transaction: jest.fn((cb: (m: unknown) => unknown) => cb(fakeManager)),
      },
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    outboxService = { record: jest.fn() };
    cache = { invalidateProduct: jest.fn(), invalidateSearch: jest.fn() };
    metrics = { increment: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: getRepositoryToken(Refund), useValue: refundsRepository },
        { provide: OutboxService, useValue: outboxService },
        { provide: CatalogCacheService, useValue: cache },
        { provide: MetricsRegistryService, useValue: metrics },
      ],
    }).compile();

    service = moduleRef.get(RefundsService);
  });

  it('rejects a request with no Idempotency-Key', async () => {
    await expect(
      service.createRefund(
        'so-1',
        { sellerOrderItemId: 'item-1', quantity: 1 },
        undefined,
        'admin-1',
        'corr-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(refundsRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it('computes gross/commission/seller amounts from the immutable snapshot, not current product price', async () => {
    const result = await service.createRefund(
      'so-1',
      { sellerOrderItemId: 'item-1', quantity: 1, reason: 'changed mind' },
      'key-1',
      'admin-1',
      'corr-1',
    );
    expect(result.amount).toBe('100.00'); // 1 * unitPrice snapshot (100.00), not any live price
    expect(result.commissionAdjustment).toBe('10.00'); // 100 * (20/200) ratio
    expect(result.sellerAdjustment).toBe('90.00');
  });

  it('writes SELLER_EARNING_REVERSAL and PLATFORM_COMMISSION_REVERSAL ledger entries', async () => {
    await service.createRefund(
      'so-1',
      { sellerOrderItemId: 'item-1', quantity: 1 },
      'key-1',
      'admin-1',
      'corr-1',
    );
    const ledgerCreateCalls = fakeManager.create.mock.calls.filter(
      (c: any[]) => c[1]?.type,
    );
    const types = ledgerCreateCalls.map((c: any[]) => c[1].type);
    expect(types).toEqual(
      expect.arrayContaining([
        'SELLER_EARNING_REVERSAL',
        'PLATFORM_COMMISSION_REVERSAL',
      ]),
    );
  });

  it('restores stock and emits STOCK_CHANGED', async () => {
    await service.createRefund(
      'so-1',
      { sellerOrderItemId: 'item-1', quantity: 1 },
      'key-1',
      'admin-1',
      'corr-1',
    );
    expect(fakeManager.createQueryBuilder).toHaveBeenCalled();
    expect(outboxService.record).toHaveBeenCalledWith(
      fakeManager,
      expect.objectContaining({ eventType: 'STOCK_CHANGED' }),
    );
    expect(cache.invalidateProduct).toHaveBeenCalledWith('product-1');
  });

  it('rejects when the seller order is not in a refund-eligible status', async () => {
    sellerOrder.status = SellerOrderStatus.CANCELLED;
    await expect(
      service.createRefund(
        'so-1',
        { sellerOrderItemId: 'item-1', quantity: 1 },
        'key-1',
        'admin-1',
        'corr-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when the item does not belong to this seller order', async () => {
    await expect(
      service.createRefund(
        'so-1',
        { sellerOrderItemId: 'nonexistent-item', quantity: 1 },
        'key-1',
        'admin-1',
        'corr-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a refund quantity exceeding what remains refundable', async () => {
    priorRefunds = [
      {
        quantity: 1,
        sellerOrderItemId: 'item-1',
        status: RefundStatus.COMPLETED,
      },
    ];
    // item.quantity is 2, 1 already refunded -> only 1 remains, requesting 2
    await expect(
      service.createRefund(
        'so-1',
        { sellerOrderItemId: 'item-1', quantity: 2 },
        'key-1',
        'admin-1',
        'corr-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('accounts for prior refunds when computing remaining refundable quantity', async () => {
    priorRefunds = [
      {
        quantity: 1,
        sellerOrderItemId: 'item-1',
        status: RefundStatus.COMPLETED,
      },
    ];
    // Exactly the remaining 1 unit should succeed.
    const result = await service.createRefund(
      'so-1',
      { sellerOrderItemId: 'item-1', quantity: 1 },
      'key-2',
      'admin-1',
      'corr-1',
    );
    expect(result.amount).toBe('100.00');
  });

  it('replays the same Refund on a unique-constraint violation (idempotent duplicate)', async () => {
    const uniqueViolationError = Object.assign(new Error('duplicate key'), {
      code: '23505',
    });
    fakeManager.save = jest.fn().mockRejectedValue(uniqueViolationError);
    refundsRepository.findOne = jest.fn().mockResolvedValue({
      id: 'refund-existing',
      sellerOrderId: 'so-1',
      sellerOrderItemId: 'item-1',
      quantity: 1,
      amount: '100.00',
      commissionAdjustment: '10.00',
      sellerAdjustment: '90.00',
      reason: null,
      status: RefundStatus.COMPLETED,
      createdAt: new Date(),
    });

    const result = await service.createRefund(
      'so-1',
      { sellerOrderItemId: 'item-1', quantity: 1 },
      'key-1',
      'admin-1',
      'corr-1',
    );
    expect(result.id).toBe('refund-existing');
    expect(metrics.increment).not.toHaveBeenCalledWith('refunds_total');
  });
});
