/**
 * Central registry of queue names. Adding a new queue for a future stage
 * (e.g. auction finalization) means adding one entry here and registering it
 * in QueueModule — nothing else needs to change.
 */
export const QUEUE_NAMES = {
  OUTBOX_PUBLISHER: 'outbox-publisher',
  SEARCH_SYNC: 'search-sync',
  NOTIFICATIONS: 'notifications',
  SELLER_ORDER_PROCESSING: 'seller-order-processing',
  AUCTION_FINALIZATION: 'auction-finalization',
  REALTIME: 'realtime',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
