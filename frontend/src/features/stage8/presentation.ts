import type { ReviewEligibility } from '../../types/review';
import type { SellerOrderStatus } from '../../types/order';

export const canOpenDispute = (status: SellerOrderStatus): boolean => status === 'SHIPPED' || status === 'DELIVERED';
export const reviewFormMode = (eligibility?: ReviewEligibility, editing = false): 'loading' | 'create' | 'edit' | 'locked' => {
  if (!eligibility) return 'loading';
  if (eligibility.existingReview && editing) return 'edit';
  if (eligibility.eligible) return 'create';
  return 'locked';
};
export const trendLabel = (change: number | null): string => change === null ? 'New baseline' : `${change >= 0 ? '+' : ''}${change}%`;
