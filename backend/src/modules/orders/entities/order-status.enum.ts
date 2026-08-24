/**
 * Always derived from the parent Order's SellerOrders — never set directly
 * by a controller. See `orders/domain/order-aggregate-status.ts` for the
 * pure aggregation function and `SellerOrderLifecycleService` for the
 * write paths that recompute and persist it whenever a child SellerOrder's
 * status materially changes.
 */
export enum OrderStatus {
  NEW = 'NEW',
  PROCESSING = 'PROCESSING',
  PARTIALLY_SHIPPED = 'PARTIALLY_SHIPPED',
  SHIPPED = 'SHIPPED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  COMPLETED = 'COMPLETED',
  PARTIALLY_CANCELLED = 'PARTIALLY_CANCELLED',
  CANCELLED = 'CANCELLED',
}
