import type { AuctionStatus } from '../../types/auction';
import type { UserRole } from '../../types/user';

export function clampPurchaseQuantity(value: number, stock: number): number {
  if (!Number.isFinite(value) || stock < 1) return 1;
  return Math.min(stock, Math.max(1, Math.trunc(value)));
}

export function auctionBidAvailability(status: AuctionStatus, role?: UserRole) {
  if (status !== 'ACTIVE') return { allowed: false, reason: 'Auction is not active' };
  if (role === 'SELLER' || role === 'ADMIN') return { allowed: false, reason: 'Customer account required' };
  return { allowed: true, reason: null };
}

export function isValidAnalyticsPeriod(from?: string, to?: string): boolean {
  if (!from || !to) return true;
  return new Date(from).getTime() <= new Date(to).getTime();
}

export function isValidRefundQuantity(quantity: number, ordered: number, alreadyRefunded: number): boolean {
  return Number.isInteger(quantity) && quantity > 0 && quantity <= ordered - alreadyRefunded;
}

export function canSubmitVerifiedReview(eligible: boolean, hasExistingReview: boolean, editing: boolean): boolean {
  return eligible || (hasExistingReview && editing);
}
