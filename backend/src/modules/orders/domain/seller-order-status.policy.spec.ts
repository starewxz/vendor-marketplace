import { ConflictException } from '@nestjs/common';
import { SellerOrderStatus } from '../entities/seller-order-status.enum';
import {
  assertCancellable,
  assertRefundable,
  assertValidStatusTransition,
  isCancellable,
} from './seller-order-status.policy';

const {
  AWAITING_FULFILLMENT,
  PROCESSING,
  SHIPPED,
  DELIVERED,
  CANCELLED,
  REFUNDED,
} = SellerOrderStatus;

describe('seller-order-status.policy', () => {
  describe('assertValidStatusTransition', () => {
    it.each([
      [AWAITING_FULFILLMENT, PROCESSING],
      [PROCESSING, SHIPPED],
      [SHIPPED, DELIVERED],
    ])('allows %s -> %s', (from, to) => {
      expect(() => assertValidStatusTransition(from, to)).not.toThrow();
    });

    it.each([
      [DELIVERED, PROCESSING],
      [CANCELLED, SHIPPED],
      [DELIVERED, CANCELLED],
      [SHIPPED, PROCESSING],
      [AWAITING_FULFILLMENT, SHIPPED],
      [AWAITING_FULFILLMENT, DELIVERED],
      [AWAITING_FULFILLMENT, CANCELLED],
      [PROCESSING, CANCELLED],
      [PROCESSING, DELIVERED],
      [PROCESSING, AWAITING_FULFILLMENT],
      [SHIPPED, AWAITING_FULFILLMENT],
      [DELIVERED, DELIVERED],
      [CANCELLED, CANCELLED],
      [REFUNDED, PROCESSING],
    ])('rejects %s -> %s', (from, to) => {
      expect(() => assertValidStatusTransition(from, to)).toThrow(
        ConflictException,
      );
    });
  });

  describe('cancellation window', () => {
    it.each([AWAITING_FULFILLMENT, PROCESSING])(
      '%s is cancellable',
      (status) => {
        expect(isCancellable(status)).toBe(true);
        expect(() => assertCancellable(status)).not.toThrow();
      },
    );

    it.each([SHIPPED, DELIVERED, CANCELLED, REFUNDED])(
      '%s is not cancellable',
      (status) => {
        expect(isCancellable(status)).toBe(false);
        expect(() => assertCancellable(status)).toThrow(ConflictException);
      },
    );
  });

  describe('refund eligibility', () => {
    it.each([PROCESSING, SHIPPED, DELIVERED])('%s is refundable', (status) => {
      expect(() => assertRefundable(status)).not.toThrow();
    });

    it.each([AWAITING_FULFILLMENT, CANCELLED, REFUNDED])(
      '%s is not refundable',
      (status) => {
        expect(() => assertRefundable(status)).toThrow(ConflictException);
      },
    );
  });
});
