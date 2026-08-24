import { SellerOrderStatus } from '../../orders/entities/seller-order-status.enum';
import { isReviewEligible, storedRatingAggregate } from './review-policy';

describe('review policy', () => {
  it('requires delivered and at least one non-refunded unit', () => {
    expect(isReviewEligible(SellerOrderStatus.DELIVERED, 2, 1)).toBe(true);
    expect(isReviewEligible(SellerOrderStatus.DELIVERED, 2, 2)).toBe(false);
    expect(isReviewEligible(SellerOrderStatus.SHIPPED, 2, 0)).toBe(false);
  });
  it('stores a deterministic two-decimal aggregate', () => {
    expect(storedRatingAggregate(3, 4.3333)).toEqual({
      ratingCount: 3,
      ratingAverage: '4.33',
    });
    expect(storedRatingAggregate(0, 0)).toEqual({
      ratingCount: 0,
      ratingAverage: '0.00',
    });
  });
});
