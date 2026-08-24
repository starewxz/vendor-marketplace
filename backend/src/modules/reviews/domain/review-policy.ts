import { SellerOrderStatus } from '../../orders/entities/seller-order-status.enum';

export function isReviewEligible(
  status: SellerOrderStatus,
  purchasedQuantity: number,
  refundedQuantity: number,
): boolean {
  return (
    status === SellerOrderStatus.DELIVERED &&
    purchasedQuantity > refundedQuantity
  );
}

export function storedRatingAggregate(
  count: number,
  average: number,
): { ratingCount: number; ratingAverage: string } {
  return {
    ratingCount: count,
    ratingAverage: count === 0 ? '0.00' : average.toFixed(2),
  };
}
