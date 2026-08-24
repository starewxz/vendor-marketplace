import { UserRole } from '../modules/users/entities/user-role.enum';

export const REALTIME_EVENTS = {
  PRODUCT_STOCK_UPDATED: 'product.stock.updated',
  AUCTION_BID_UPDATED: 'auction.bid.updated',
  AUCTION_STARTED: 'auction.started',
  AUCTION_FINALIZED: 'auction.finalized',
  AUCTION_WON: 'auction.won',
  AUCTION_UNSOLD: 'auction.unsold',
  AUCTION_PURCHASE_WINDOW_OPENED: 'auction.purchase_window.opened',
  AUCTION_PURCHASED: 'auction.purchased',
  AUCTION_PURCHASE_WINDOW_EXPIRED: 'auction.purchase_window.expired',
  ORDER_STATUS_UPDATED: 'order.status.updated',
} as const;

export interface SocketIdentity {
  userId: string;
  role: UserRole;
  sellerProfileId: string | null;
}

export interface RealtimeSocketData {
  identity: SocketIdentity | null;
  correlationId: string;
}

export interface RealtimeJobData {
  outboxEventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId: string;
}

export interface SubscriptionRequest {
  id: string;
}

export interface SubscriptionResult {
  ok: boolean;
  room?: string;
  error?: string;
}

export const productRoom = (id: string) => `product:${id}`;
export const auctionRoom = (id: string) => `auction:${id}`;
export const userRoom = (id: string) => `user:${id}`;
export const sellerRoom = (id: string) => `seller:${id}`;
export const orderRoom = (id: string) => `order:${id}`;
