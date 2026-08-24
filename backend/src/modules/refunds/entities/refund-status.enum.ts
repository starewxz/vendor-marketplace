/**
 * PROCESSING is the idempotency claim written as the first step of the
 * refund transaction (mirrors CheckoutIdempotencyKey — see
 * RefundsService.createRefund). There is no FAILED status: a failed
 * refund attempt rolls back the whole transaction, including this row, so
 * a failed attempt leaves nothing durable and the same idempotency key
 * remains reusable.
 */
export enum RefundStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
}
