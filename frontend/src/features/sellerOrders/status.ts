import type { OrderStatus, SellerOrderStatus } from '../../types/order';

export const SELLER_ORDER_STATUS_TONE: Record<SellerOrderStatus, 'yellow' | 'blue' | 'coral' | 'mint' | 'neutral'> = {
  AWAITING_FULFILLMENT: 'yellow',
  PROCESSING: 'blue',
  SHIPPED: 'blue',
  DELIVERED: 'mint',
  CANCELLED: 'coral',
  REFUNDED: 'coral',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, 'yellow' | 'blue' | 'coral' | 'mint' | 'neutral'> = {
  NEW: 'yellow',
  PROCESSING: 'blue',
  PARTIALLY_SHIPPED: 'blue',
  SHIPPED: 'blue',
  PARTIALLY_COMPLETED: 'mint',
  COMPLETED: 'mint',
  PARTIALLY_CANCELLED: 'coral',
  CANCELLED: 'coral',
};

/** Mirrors the backend's forward-only transition policy (see
 * orders/domain/seller-order-status.policy.ts) — used only to decide which
 * single "next" action button to show, never as the source of truth (the
 * backend still validates/enforces every transition). */
const NEXT_STATUS: Partial<Record<SellerOrderStatus, { status: SellerOrderStatus; label: string }>> = {
  AWAITING_FULFILLMENT: { status: 'PROCESSING', label: 'Start processing' },
  PROCESSING: { status: 'SHIPPED', label: 'Mark shipped' },
  SHIPPED: { status: 'DELIVERED', label: 'Mark delivered' },
};

export function nextStatusAction(status: SellerOrderStatus) {
  return NEXT_STATUS[status] ?? null;
}

const CANCELLABLE_FROM: readonly SellerOrderStatus[] = ['AWAITING_FULFILLMENT', 'PROCESSING'];

export function isCancellable(status: SellerOrderStatus): boolean {
  return CANCELLABLE_FROM.includes(status);
}

export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}
