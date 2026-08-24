import { describe, expect, it } from 'vitest';
import { canOpenDispute, reviewFormMode, trendLabel } from './presentation';

describe('Stage 8 UI state', () => {
  it('only offers disputes for shipped/delivered seller orders', () => {
    expect(canOpenDispute('SHIPPED')).toBe(true); expect(canOpenDispute('DELIVERED')).toBe(true); expect(canOpenDispute('PROCESSING')).toBe(false);
  });
  it('derives review form state from authoritative eligibility', () => {
    expect(reviewFormMode({ eligible: true, sellerOrderItemId: 'item', existingReview: null })).toBe('create');
    expect(reviewFormMode({ eligible: false, sellerOrderItemId: null, existingReview: null })).toBe('locked');
  });
  it('formats safe comparisons', () => { expect(trendLabel(null)).toBe('New baseline'); expect(trendLabel(-12.5)).toBe('-12.5%'); });
});
