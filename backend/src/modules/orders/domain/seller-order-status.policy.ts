import { ConflictException } from '@nestjs/common';
import { SellerOrderStatus } from '../entities/seller-order-status.enum';

/**
 * The single source of truth for which SellerOrder status transitions are
 * legal. Both the seller-facing and admin-facing endpoints call the same
 * functions here — admin privileges widen *who* can act, never *what*
 * transitions are valid (see README "SellerOrder lifecycle").
 */

const FORWARD_TRANSITIONS: Record<SellerOrderStatus, SellerOrderStatus[]> = {
  [SellerOrderStatus.AWAITING_FULFILLMENT]: [SellerOrderStatus.PROCESSING],
  [SellerOrderStatus.PROCESSING]: [SellerOrderStatus.SHIPPED],
  [SellerOrderStatus.SHIPPED]: [SellerOrderStatus.DELIVERED],
  [SellerOrderStatus.DELIVERED]: [],
  [SellerOrderStatus.CANCELLED]: [],
  [SellerOrderStatus.REFUNDED]: [],
};

/** States a SellerOrder can be cancelled from. Once SHIPPED, the seller has
 * already handed the item to a carrier — cancellation stops being the
 * right tool and a partial/full refund is used instead (see README
 * "Cancellation vs refund"). */
const CANCELLABLE_FROM: readonly SellerOrderStatus[] = [
  SellerOrderStatus.AWAITING_FULFILLMENT,
  SellerOrderStatus.PROCESSING,
];

/** States a SellerOrder can accept a partial refund from — must have
 * progressed past AWAITING_FULFILLMENT (nothing shipped yet — cancel
 * instead) and must not already be CANCELLED (already fully reversed). */
const REFUNDABLE_FROM: readonly SellerOrderStatus[] = [
  SellerOrderStatus.PROCESSING,
  SellerOrderStatus.SHIPPED,
  SellerOrderStatus.DELIVERED,
];

export function assertValidStatusTransition(
  from: SellerOrderStatus,
  to: SellerOrderStatus,
): void {
  if (!FORWARD_TRANSITIONS[from]?.includes(to)) {
    throw new ConflictException(
      `Cannot transition seller order from ${from} to ${to}`,
    );
  }
}

export function isCancellable(status: SellerOrderStatus): boolean {
  return CANCELLABLE_FROM.includes(status);
}

export function assertCancellable(status: SellerOrderStatus): void {
  if (!isCancellable(status)) {
    throw new ConflictException(
      `A seller order in status ${status} cannot be cancelled`,
    );
  }
}

export function assertRefundable(status: SellerOrderStatus): void {
  if (!REFUNDABLE_FROM.includes(status)) {
    throw new ConflictException(
      `A seller order in status ${status} is not eligible for a refund`,
    );
  }
}
