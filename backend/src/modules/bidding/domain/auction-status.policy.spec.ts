import { ConflictException } from '@nestjs/common';
import { AuctionStatus } from '../entities/auction-status.enum';
import {
  assertAuctionCancellable,
  assertValidAuctionTransition,
  isAuctionCancellable,
  isWithinBiddingWindow,
} from './auction-status.policy';

const {
  SCHEDULED,
  ACTIVE,
  ENDED,
  UNSOLD,
  EXPIRED,
  AWAITING_PAYMENT,
  COMPLETED,
  CANCELLED,
} = AuctionStatus;

describe('auction-status.policy', () => {
  describe('assertValidAuctionTransition', () => {
    it.each([
      [SCHEDULED, ACTIVE],
      [SCHEDULED, CANCELLED],
      [ACTIVE, UNSOLD],
      [ACTIVE, AWAITING_PAYMENT],
      [ACTIVE, CANCELLED],
      [AWAITING_PAYMENT, COMPLETED],
      [AWAITING_PAYMENT, EXPIRED],
    ])('allows %s -> %s', (from, to) => {
      expect(() => assertValidAuctionTransition(from, to)).not.toThrow();
    });

    it.each([
      [ENDED, ACTIVE],
      [COMPLETED, ACTIVE],
      [CANCELLED, ACTIVE],
      [SCHEDULED, ENDED],
      [SCHEDULED, AWAITING_PAYMENT],
      [SCHEDULED, COMPLETED],
      [ACTIVE, SCHEDULED],
      [ACTIVE, COMPLETED],
      [AWAITING_PAYMENT, ACTIVE],
      [AWAITING_PAYMENT, CANCELLED],
      [ENDED, ENDED],
      [COMPLETED, COMPLETED],
    ])('rejects %s -> %s', (from, to) => {
      expect(() => assertValidAuctionTransition(from, to)).toThrow(
        ConflictException,
      );
    });
  });

  describe('cancellation window', () => {
    it.each([SCHEDULED, ACTIVE])('%s is cancellable', (status) => {
      expect(isAuctionCancellable(status)).toBe(true);
      expect(() => assertAuctionCancellable(status)).not.toThrow();
    });

    it.each([ENDED, UNSOLD, EXPIRED, AWAITING_PAYMENT, COMPLETED, CANCELLED])(
      '%s is not cancellable',
      (status) => {
        expect(isAuctionCancellable(status)).toBe(false);
        expect(() => assertAuctionCancellable(status)).toThrow(
          ConflictException,
        );
      },
    );
  });

  describe('isWithinBiddingWindow', () => {
    const startsAt = new Date('2026-01-01T00:00:00.000Z');
    const endsAt = new Date('2026-01-02T00:00:00.000Z');

    it('is false before startsAt', () => {
      expect(
        isWithinBiddingWindow(
          startsAt,
          endsAt,
          new Date('2025-12-31T23:59:59.999Z'),
        ),
      ).toBe(false);
    });

    it('is true exactly at startsAt', () => {
      expect(isWithinBiddingWindow(startsAt, endsAt, startsAt)).toBe(true);
    });

    it('is true just before endsAt', () => {
      expect(
        isWithinBiddingWindow(
          startsAt,
          endsAt,
          new Date('2026-01-01T23:59:59.999Z'),
        ),
      ).toBe(true);
    });

    it('is false exactly at endsAt (the deadline is exclusive)', () => {
      expect(isWithinBiddingWindow(startsAt, endsAt, endsAt)).toBe(false);
    });

    it('is false after endsAt', () => {
      expect(
        isWithinBiddingWindow(
          startsAt,
          endsAt,
          new Date('2026-01-02T00:00:01.000Z'),
        ),
      ).toBe(false);
    });
  });
});
