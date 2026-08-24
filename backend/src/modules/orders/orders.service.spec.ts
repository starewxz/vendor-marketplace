import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';

describe('OrdersService — ownership scoping (IDOR)', () => {
  let service: OrdersService;
  let ordersRepository: { findOne: jest.Mock; findAndCount: jest.Mock };

  beforeEach(async () => {
    ordersRepository = { findOne: jest.fn(), findAndCount: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: ordersRepository },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  it('scopes the detail query by (id, buyerId) together, not id alone', async () => {
    ordersRepository.findOne.mockResolvedValue(null);
    await expect(
      service.findMineById('other-customer', 'order-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(ordersRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1', buyerId: 'other-customer' },
      }),
    );
  });

  it('omits seller commission/net financial fields from the customer view', async () => {
    ordersRepository.findOne.mockResolvedValue({
      id: 'order-1',
      buyerId: 'customer-1',
      status: 'PENDING_PAYMENT',
      totalAmount: '20.00',
      createdAt: new Date(),
      shippingAddressLine1: null,
      shippingAddressLine2: null,
      shippingCity: null,
      shippingPostalCode: null,
      shippingCountry: null,
      sellerOrders: [
        {
          id: 'so-1',
          status: 'AWAITING_FULFILLMENT',
          subtotal: '20.00',
          commissionAmount: '2.00',
          sellerNetAmount: '18.00',
          sellerProfile: { storeName: 'Store' },
          items: [],
        },
      ],
    });

    const view = await service.findMineById('customer-1', 'order-1');
    expect(view.sellerOrders[0]).not.toHaveProperty('commissionAmount');
    expect(view.sellerOrders[0]).not.toHaveProperty('sellerNetAmount');
    expect(view.sellerOrders[0].storeName).toBe('Store');
  });

  it("lists only the requesting customer's own orders", async () => {
    ordersRepository.findAndCount.mockResolvedValue([[], 0]);
    await service.findMine('customer-1', { page: 1, pageSize: 20 });

    expect(ordersRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { buyerId: 'customer-1' } }),
    );
  });
});
