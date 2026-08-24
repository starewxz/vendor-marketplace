import { OrderStatus } from '../entities/order-status.enum';
import { SellerOrderStatus } from '../entities/seller-order-status.enum';

/**
 * Pure function: given every SellerOrder status under one parent Order,
 * derive the parent's aggregate status. Called after every SellerOrder
 * status change (see SellerOrderLifecycleService) — the parent Order never
 * has its status set directly by a controller.
 *
 * Two axes, evaluated in this order:
 *
 * 1. Cancellation is orthogonal to progress. If *some* (not all)
 *    SellerOrders are CANCELLED, the parent is PARTIALLY_CANCELLED
 *    regardless of how far along the rest are — the customer needs to
 *    know something in their order didn't ship, full stop. If *all* are
 *    CANCELLED, the parent is CANCELLED.
 * 2. Otherwise (no cancellations), the parent reflects the least-advanced
 *    vs. most-advanced fulfillment rank across the non-cancelled
 *    SellerOrders: all equal -> the pure state; a spread -> the PARTIALLY_
 *    variant of whichever end is furthest along.
 */

const PROGRESS_RANK: Partial<Record<SellerOrderStatus, number>> = {
  [SellerOrderStatus.AWAITING_FULFILLMENT]: 0,
  [SellerOrderStatus.PROCESSING]: 1,
  [SellerOrderStatus.SHIPPED]: 2,
  [SellerOrderStatus.DELIVERED]: 3,
};

function rankOf(status: SellerOrderStatus): number {
  // REFUNDED isn't reachable via this stage's transitions, but treat it as
  // terminal-complete defensively rather than crashing the aggregation.
  return PROGRESS_RANK[status] ?? 3;
}

export function deriveParentOrderStatus(
  sellerOrderStatuses: SellerOrderStatus[],
): OrderStatus {
  if (sellerOrderStatuses.length === 0) {
    return OrderStatus.NEW;
  }

  const cancelled = sellerOrderStatuses.filter(
    (s) => s === SellerOrderStatus.CANCELLED,
  );
  const active = sellerOrderStatuses.filter(
    (s) => s !== SellerOrderStatus.CANCELLED,
  );

  if (active.length === 0) {
    return OrderStatus.CANCELLED;
  }
  if (cancelled.length > 0) {
    return OrderStatus.PARTIALLY_CANCELLED;
  }

  const ranks = active.map(rankOf);
  const min = Math.min(...ranks);
  const max = Math.max(...ranks);

  if (max === 3) {
    return min === 3 ? OrderStatus.COMPLETED : OrderStatus.PARTIALLY_COMPLETED;
  }
  if (max === 2) {
    return min === 2 ? OrderStatus.SHIPPED : OrderStatus.PARTIALLY_SHIPPED;
  }
  if (max === 1) {
    // At least one PROCESSING, none SHIPPED/DELIVERED yet.
    return OrderStatus.PROCESSING;
  }
  return OrderStatus.NEW;
}
