/**
 * AWAITING_FULFILLMENT is the initial state a SellerOrder is created in at
 * checkout — it plays the role of "NEW" from the Stage 4 spec, so a
 * separate NEW value would be redundant. PROCESSING is the status the
 * Stage 4 async SellerOrder processor transitions it to.
 */
export enum SellerOrderStatus {
  AWAITING_FULFILLMENT = 'AWAITING_FULFILLMENT',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}
