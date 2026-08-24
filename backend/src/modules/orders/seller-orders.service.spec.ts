import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SellerOrdersService } from './seller-orders.service';
import { SellerOrder } from './entities/seller-order.entity';

describe('SellerOrdersService — ownership scoping (IDOR)', () => {
  let service: SellerOrdersService;
  let sellerOrdersRepository: { findOne: jest.Mock; findAndCount: jest.Mock };

  beforeEach(async () => {
    sellerOrdersRepository = { findOne: jest.fn(), findAndCount: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SellerOrdersService,
        {
          provide: getRepositoryToken(SellerOrder),
          useValue: sellerOrdersRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(SellerOrdersService);
  });

  it('scopes the detail query by (id, sellerProfileId) together, not id alone', async () => {
    sellerOrdersRepository.findOne.mockResolvedValue(null);
    await expect(
      service.findMineById('other-seller', 'seller-order-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(sellerOrdersRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'seller-order-1', sellerProfileId: 'other-seller' },
      }),
    );
  });

  it("includes the seller's own commission/net breakdown in the detail view", async () => {
    sellerOrdersRepository.findOne.mockResolvedValue({
      id: 'so-1',
      orderId: 'order-1',
      status: 'AWAITING_FULFILLMENT',
      subtotal: '20.00',
      commissionAmount: '2.00',
      sellerNetAmount: '18.00',
      createdAt: new Date(),
      items: [],
      order: {
        shippingAddressLine1: null,
        shippingAddressLine2: null,
        shippingCity: null,
        shippingPostalCode: null,
        shippingCountry: null,
      },
    });

    const view = await service.findMineById('seller-1', 'so-1');
    expect(view.commissionAmount).toBe('2.00');
    expect(view.sellerNetAmount).toBe('18.00');
  });

  it("lists only the requesting seller's own seller orders", async () => {
    sellerOrdersRepository.findAndCount.mockResolvedValue([[], 0]);
    await service.findMine('seller-1', { page: 1, pageSize: 20 });

    expect(sellerOrdersRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sellerProfileId: 'seller-1' } }),
    );
  });
});
