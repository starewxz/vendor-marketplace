/* eslint-disable @typescript-eslint/no-unsafe-member-access -- fakeManager is an untyped jest.fn() mock of EntityManager */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SellerOrderLifecycleService } from './seller-order-lifecycle.service';
import { SellerOrder } from './entities/seller-order.entity';
import { SellerOrderStatus } from './entities/seller-order-status.enum';
import { Order } from './entities/order.entity';
import { OrderStatus } from './entities/order-status.enum';
import { OutboxService } from '../outbox/outbox.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';

function fakeQueryBuilder(affected: number) {
  return {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected }),
  };
}

function sellerOrderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'so-1',
    orderId: 'order-1',
    sellerProfileId: 'seller-1',
    status: SellerOrderStatus.PROCESSING,
    subtotal: '100.00',
    commissionAmount: '10.00',
    sellerNetAmount: '90.00',
    ...overrides,
  };
}

describe('SellerOrderLifecycleService', () => {
  let service: SellerOrderLifecycleService;
  let sellerOrdersRepository: { manager: any };
  let outboxService: { record: jest.Mock };
  let cache: { invalidateProduct: jest.Mock; invalidateSearch: jest.Mock };
  let metrics: { increment: jest.Mock };
  let fakeManager: any;
  let currentSellerOrder: ReturnType<typeof sellerOrderFixture>;

  beforeEach(async () => {
    currentSellerOrder = sellerOrderFixture();
    fakeManager = {
      findOne: jest.fn((entity: unknown) => {
        if (entity === SellerOrder) return Promise.resolve(currentSellerOrder);
        if (entity === Order)
          return Promise.resolve({
            id: 'order-1',
            status: OrderStatus.PROCESSING,
          });
        return Promise.resolve(null);
      }),
      find: jest.fn((entity: unknown) => {
        if (entity === SellerOrder)
          return Promise.resolve([currentSellerOrder]);
        return Promise.resolve([]); // SellerOrderItem default: no items
      }),
      save: jest.fn((entity: any) => Promise.resolve(entity)),
      create: jest.fn((_entity: unknown, data: unknown) => ({
        ...(data as object),
      })),
      createQueryBuilder: jest.fn(() => fakeQueryBuilder(1)),
    };
    sellerOrdersRepository = {
      manager: {
        transaction: jest.fn((cb: (m: unknown) => unknown) => cb(fakeManager)),
      },
    };
    outboxService = { record: jest.fn() };
    cache = { invalidateProduct: jest.fn(), invalidateSearch: jest.fn() };
    metrics = { increment: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SellerOrderLifecycleService,
        {
          provide: getRepositoryToken(SellerOrder),
          useValue: sellerOrdersRepository,
        },
        { provide: OutboxService, useValue: outboxService },
        { provide: CatalogCacheService, useValue: cache },
        { provide: MetricsRegistryService, useValue: metrics },
      ],
    }).compile();

    service = moduleRef.get(SellerOrderLifecycleService);
  });

  describe('updateStatus', () => {
    it('applies a valid forward transition and records an outbox event', async () => {
      const result = await service.updateStatus(
        { type: 'seller', sellerProfileId: 'seller-1' },
        'so-1',
        SellerOrderStatus.SHIPPED,
        'corr-1',
      );
      expect(result.status).toBe(SellerOrderStatus.SHIPPED);
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({ eventType: 'SELLER_ORDER_STATUS_CHANGED' }),
      );
      expect(metrics.increment).toHaveBeenCalledWith(
        'seller_order_status_changes_total',
      );
    });

    it('rejects an invalid transition', async () => {
      currentSellerOrder.status = SellerOrderStatus.DELIVERED;
      await expect(
        service.updateStatus(
          { type: 'seller', sellerProfileId: 'seller-1' },
          'so-1',
          SellerOrderStatus.PROCESSING,
          'corr-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('scopes the lookup to the seller who owns it', async () => {
      fakeManager.findOne = jest.fn((entity: unknown) => {
        if (entity === SellerOrder) return Promise.resolve(null); // not owned by this seller
        return Promise.resolve(null);
      });
      await expect(
        service.updateStatus(
          { type: 'seller', sellerProfileId: 'other-seller' },
          'so-1',
          SellerOrderStatus.SHIPPED,
          'corr-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('admin actor is unscoped (no sellerProfileId filter)', async () => {
      await service.updateStatus(
        { type: 'admin' },
        'so-1',
        SellerOrderStatus.SHIPPED,
        'corr-1',
      );
      expect(fakeManager.findOne).toHaveBeenCalledWith(
        SellerOrder,
        expect.objectContaining({ where: { id: 'so-1' } }),
      );
    });

    it('recomputes and persists the parent Order status when the aggregate changes', async () => {
      currentSellerOrder.status = SellerOrderStatus.PROCESSING;
      fakeManager.find = jest.fn((entity: unknown) => {
        if (entity === SellerOrder) {
          return Promise.resolve([
            { ...currentSellerOrder, status: SellerOrderStatus.SHIPPED },
          ]);
        }
        return Promise.resolve([]);
      });
      await service.updateStatus(
        { type: 'seller', sellerProfileId: 'seller-1' },
        'so-1',
        SellerOrderStatus.SHIPPED,
        'corr-1',
      );
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({ eventType: 'ORDER_STATUS_CHANGED' }),
      );
    });
  });

  describe('cancel', () => {
    it('restores stock and writes reversal ledger entries for a cancellable seller order', async () => {
      fakeManager.find = jest.fn((entity: unknown) => {
        if (entity === SellerOrder)
          return Promise.resolve([currentSellerOrder]);
        // SellerOrderItem lookup
        return Promise.resolve([
          { id: 'item-1', productId: 'product-1', quantity: 2 },
        ]);
      });

      const result = await service.cancel(
        { type: 'seller', sellerProfileId: 'seller-1' },
        'so-1',
        'corr-1',
      );

      expect(result.status).toBe(SellerOrderStatus.CANCELLED);
      expect(fakeManager.createQueryBuilder).toHaveBeenCalled(); // stock restore
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({ eventType: 'STOCK_CHANGED' }),
      );
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({ eventType: 'SELLER_ORDER_CANCELLED' }),
      );
      expect(metrics.increment).toHaveBeenCalledWith(
        'seller_order_cancellations_total',
      );
      expect(cache.invalidateProduct).toHaveBeenCalledWith('product-1');
    });

    it('rejects cancelling a SHIPPED seller order', async () => {
      currentSellerOrder.status = SellerOrderStatus.SHIPPED;
      await expect(
        service.cancel(
          { type: 'seller', sellerProfileId: 'seller-1' },
          'so-1',
          'corr-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('is idempotent: cancelling an already-CANCELLED seller order is a no-op, not an error', async () => {
      currentSellerOrder.status = SellerOrderStatus.CANCELLED;
      const result = await service.cancel(
        { type: 'seller', sellerProfileId: 'seller-1' },
        'so-1',
        'corr-1',
      );
      expect(result.status).toBe(SellerOrderStatus.CANCELLED);
      expect(fakeManager.createQueryBuilder).not.toHaveBeenCalled(); // no stock touched
      expect(cache.invalidateProduct).not.toHaveBeenCalled();
    });

    it("a seller cannot cancel another seller's seller order (404, not leaked)", async () => {
      fakeManager.findOne = jest.fn(() => Promise.resolve(null));
      await expect(
        service.cancel(
          { type: 'seller', sellerProfileId: 'other-seller' },
          'so-1',
          'corr-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
