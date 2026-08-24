import { UserRole } from '../modules/users/entities/user-role.enum';
import { RealtimeSubscriptionService } from './realtime-subscription.service';

describe('RealtimeSubscriptionService', () => {
  const products = { exists: jest.fn() };
  const auctions = { exists: jest.fn() };
  const orders = { exists: jest.fn() };
  const service = new RealtimeSubscriptionService(
    products as never,
    auctions as never,
    orders as never,
  );
  const id = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => jest.clearAllMocks());

  it('joins a validated public product room', async () => {
    products.exists.mockResolvedValue(true);
    const socket = { join: jest.fn(), data: { identity: null } };
    await expect(
      service.subscribeProduct(socket as never, id),
    ).resolves.toEqual({
      ok: true,
      room: `product:${id}`,
    });
    expect(socket.join).toHaveBeenCalledWith(`product:${id}`);
  });

  it('rejects anonymous private order subscriptions', async () => {
    const socket = { join: jest.fn(), data: { identity: null } };
    await expect(service.subscribeOrder(socket as never, id)).resolves.toEqual({
      ok: false,
      error: 'Authentication required',
    });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('scopes a customer order lookup to the authenticated identity', async () => {
    orders.exists.mockResolvedValue(false);
    const socket = {
      join: jest.fn(),
      data: {
        identity: {
          userId: 'customer-a',
          role: UserRole.CUSTOMER,
          sellerProfileId: null,
        },
      },
    };
    await expect(service.subscribeOrder(socket as never, id)).resolves.toEqual({
      ok: false,
      error: 'Order not found',
    });
    expect(orders.exists).toHaveBeenCalledWith({
      where: { id, buyerId: 'customer-a' },
    });
    expect(socket.join).not.toHaveBeenCalled();
  });
});
