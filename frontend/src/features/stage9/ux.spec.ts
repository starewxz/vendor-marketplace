import { describe, expect, it } from 'vitest';
import {
  auctionBidAvailability,
  canSubmitVerifiedReview,
  clampPurchaseQuantity,
  isValidAnalyticsPeriod,
  isValidRefundQuantity,
} from './ux';

describe('Stage 9 integration UX policies', () => {
  it('keeps cart quantities within authoritative visible stock', () => {
    expect(clampPurchaseQuantity(0, 4)).toBe(1);
    expect(clampPurchaseQuantity(8, 4)).toBe(4);
    expect(clampPurchaseQuantity(2.8, 4)).toBe(2);
  });

  it('only offers bidding while active and from a customer-capable session', () => {
    expect(auctionBidAvailability('ACTIVE', 'CUSTOMER').allowed).toBe(true);
    expect(auctionBidAvailability('ACTIVE', 'SELLER').allowed).toBe(false);
    expect(auctionBidAvailability('COMPLETED', 'CUSTOMER').allowed).toBe(false);
  });

  it('validates analytics periods before requesting a report', () => {
    expect(isValidAnalyticsPeriod('2026-08-01', '2026-08-31')).toBe(true);
    expect(isValidAnalyticsPeriod('2026-09-01', '2026-08-31')).toBe(false);
  });

  it('prevents zero, fractional, and over-refund quantities in the UI', () => {
    expect(isValidRefundQuantity(1, 2, 1)).toBe(true);
    expect(isValidRefundQuantity(2, 2, 1)).toBe(false);
    expect(isValidRefundQuantity(0.5, 2, 0)).toBe(false);
  });

  it('shows review editing only to an eligible buyer or owner editing an existing review', () => {
    expect(canSubmitVerifiedReview(false, false, false)).toBe(false);
    expect(canSubmitVerifiedReview(true, false, false)).toBe(true);
    expect(canSubmitVerifiedReview(false, true, true)).toBe(true);
  });
});
