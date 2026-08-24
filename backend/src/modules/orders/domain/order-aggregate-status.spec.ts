import { OrderStatus } from '../entities/order-status.enum';
import { SellerOrderStatus } from '../entities/seller-order-status.enum';
import { deriveParentOrderStatus } from './order-aggregate-status';

const { AWAITING_FULFILLMENT, PROCESSING, SHIPPED, DELIVERED, CANCELLED } =
  SellerOrderStatus;

describe('deriveParentOrderStatus', () => {
  it('returns NEW for an empty list (defensive default)', () => {
    expect(deriveParentOrderStatus([])).toBe(OrderStatus.NEW);
  });

  it('all AWAITING_FULFILLMENT -> NEW', () => {
    expect(
      deriveParentOrderStatus([AWAITING_FULFILLMENT, AWAITING_FULFILLMENT]),
    ).toBe(OrderStatus.NEW);
  });

  it('any PROCESSING, none shipped/completed -> PROCESSING', () => {
    expect(deriveParentOrderStatus([PROCESSING, PROCESSING])).toBe(
      OrderStatus.PROCESSING,
    );
    expect(deriveParentOrderStatus([AWAITING_FULFILLMENT, PROCESSING])).toBe(
      OrderStatus.PROCESSING,
    );
  });

  it('some SHIPPED, others earlier -> PARTIALLY_SHIPPED', () => {
    expect(deriveParentOrderStatus([SHIPPED, PROCESSING])).toBe(
      OrderStatus.PARTIALLY_SHIPPED,
    );
    expect(deriveParentOrderStatus([SHIPPED, AWAITING_FULFILLMENT])).toBe(
      OrderStatus.PARTIALLY_SHIPPED,
    );
  });

  it('all SHIPPED -> SHIPPED', () => {
    expect(deriveParentOrderStatus([SHIPPED, SHIPPED])).toBe(
      OrderStatus.SHIPPED,
    );
  });

  it('some COMPLETED (DELIVERED), others not -> PARTIALLY_COMPLETED', () => {
    expect(deriveParentOrderStatus([DELIVERED, SHIPPED])).toBe(
      OrderStatus.PARTIALLY_COMPLETED,
    );
    expect(deriveParentOrderStatus([DELIVERED, PROCESSING])).toBe(
      OrderStatus.PARTIALLY_COMPLETED,
    );
    expect(deriveParentOrderStatus([DELIVERED, AWAITING_FULFILLMENT])).toBe(
      OrderStatus.PARTIALLY_COMPLETED,
    );
  });

  it('all COMPLETED (DELIVERED) -> COMPLETED', () => {
    expect(deriveParentOrderStatus([DELIVERED, DELIVERED])).toBe(
      OrderStatus.COMPLETED,
    );
  });

  it('single SellerOrder mirrors its own status (no partial ambiguity)', () => {
    expect(deriveParentOrderStatus([DELIVERED])).toBe(OrderStatus.COMPLETED);
    expect(deriveParentOrderStatus([SHIPPED])).toBe(OrderStatus.SHIPPED);
    expect(deriveParentOrderStatus([PROCESSING])).toBe(OrderStatus.PROCESSING);
    expect(deriveParentOrderStatus([CANCELLED])).toBe(OrderStatus.CANCELLED);
  });

  it('some CANCELLED, others active -> PARTIALLY_CANCELLED regardless of the others progress', () => {
    expect(deriveParentOrderStatus([CANCELLED, AWAITING_FULFILLMENT])).toBe(
      OrderStatus.PARTIALLY_CANCELLED,
    );
    expect(deriveParentOrderStatus([CANCELLED, PROCESSING])).toBe(
      OrderStatus.PARTIALLY_CANCELLED,
    );
    expect(deriveParentOrderStatus([CANCELLED, SHIPPED])).toBe(
      OrderStatus.PARTIALLY_CANCELLED,
    );
    expect(deriveParentOrderStatus([CANCELLED, DELIVERED])).toBe(
      OrderStatus.PARTIALLY_CANCELLED,
    );
  });

  it('some CANCELLED, others also CANCELLED and one active -> still PARTIALLY_CANCELLED', () => {
    expect(deriveParentOrderStatus([CANCELLED, CANCELLED, PROCESSING])).toBe(
      OrderStatus.PARTIALLY_CANCELLED,
    );
  });

  it('all CANCELLED -> CANCELLED', () => {
    expect(deriveParentOrderStatus([CANCELLED, CANCELLED])).toBe(
      OrderStatus.CANCELLED,
    );
  });
});
