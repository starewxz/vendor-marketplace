/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- focused repository/emit mocks */
import { RealtimeProcessor } from './realtime.processor';

function job(overrides: Record<string, unknown>) {
  return {
    data: {
      outboxEventId: 'event-1',
      eventType: 'STOCK_CHANGED',
      aggregateType: 'Product',
      aggregateId: 'product-1',
      payload: {},
      correlationId: 'corr-1',
      ...overrides,
    },
    attemptsMade: 0,
  } as never;
}

describe('RealtimeProcessor routing', () => {
  const processed = {
    exists: jest.fn().mockResolvedValue(false),
    create: jest.fn((value) => value),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const products = { findOne: jest.fn() };
  const auctions = { findOne: jest.fn() };
  const bids = { count: jest.fn() };
  const sellerOrders = { findOne: jest.fn() };
  const disputes = { findOne: jest.fn() };
  const realtime = { emitToRooms: jest.fn() };
  const metrics = { observe: jest.fn(), increment: jest.fn() };
  const processor = new RealtimeProcessor(
    processed as never,
    products as never,
    auctions as never,
    bids as never,
    sellerOrders as never,
    realtime as never,
    disputes as never,
    metrics as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('routes a dispute only to its owning customer and seller private rooms', async () => {
    disputes.findOne.mockResolvedValue({
      id: 'dispute-1',
      customerId: 'customer-1',
      sellerProfileId: 'seller-1',
      sellerOrderId: 'seller-order-1',
      status: 'OPEN',
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    await processor.process(
      job({
        aggregateType: 'Dispute',
        aggregateId: 'dispute-1',
        eventType: 'DISPUTE_OPENED',
      }),
    );
    expect(realtime.emitToRooms).toHaveBeenCalledWith(
      ['user:customer-1', 'seller:seller-1'],
      'dispute.opened',
      expect.objectContaining({ disputeId: 'dispute-1', status: 'OPEN' }),
      expect.any(Object),
    );
  });

  it('routes current committed stock to only the product room', async () => {
    products.findOne.mockResolvedValue({
      id: 'product-1',
      stockQuantity: 3,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    await processor.process(job({}));
    expect(realtime.emitToRooms).toHaveBeenCalledWith(
      ['product:product-1'],
      'product.stock.updated',
      expect.objectContaining({ productId: 'product-1', stock: 3 }),
      expect.any(Object),
    );
  });

  it('routes accepted bid state without exposing bidder identity', async () => {
    auctions.findOne.mockResolvedValue({
      id: 'auction-1',
      status: 'ACTIVE',
      currentPrice: '110.00',
      startPrice: '100.00',
      minBidIncrement: '10.00',
      endsAt: new Date('2026-01-02T00:00:00Z'),
      purchaseWindowEndsAt: null,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    bids.count.mockResolvedValue(1);
    await processor.process(
      job({
        aggregateType: 'Auction',
        aggregateId: 'auction-1',
        eventType: 'BID_PLACED',
      }),
    );
    const payload = realtime.emitToRooms.mock.calls[0][2];
    expect(payload).toMatchObject({
      auctionId: 'auction-1',
      currentPrice: '110.00',
      minimumNextBid: '120.00',
    });
    expect(payload).not.toHaveProperty('bidderId');
    expect(payload).not.toHaveProperty('winnerId');
  });

  it('routes order state only to its customer, owning seller and authorized order room', async () => {
    sellerOrders.findOne.mockResolvedValue({
      id: 'seller-order-1',
      orderId: 'order-1',
      sellerProfileId: 'seller-a',
      status: 'SHIPPED',
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      order: { buyerId: 'customer-a', status: 'SHIPPED' },
    });
    await processor.process(
      job({
        aggregateType: 'SellerOrder',
        aggregateId: 'seller-order-1',
        eventType: 'SELLER_ORDER_STATUS_CHANGED',
      }),
    );
    expect(realtime.emitToRooms).toHaveBeenCalledWith(
      ['user:customer-a', 'seller:seller-a', 'order:order-1'],
      'order.status.updated',
      expect.objectContaining({ sellerOrderId: 'seller-order-1' }),
      expect.any(Object),
    );
    expect(realtime.emitToRooms.mock.calls[0][0]).not.toContain(
      'seller:seller-b',
    );
  });
});
