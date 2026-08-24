import type { AuctionStatus } from '../types/auction';
import type { OrderStatus, SellerOrderStatus } from '../types/order';

export type RealtimeConnectionStatus =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'offline';

export interface ProductStockUpdatedEvent {
  productId: string;
  stock: number;
  updatedAt: string;
}

export interface AuctionUpdatedEvent {
  auctionId: string;
  status: AuctionStatus;
  currentPrice: string;
  bidCount: number;
  minimumNextBid: string;
  endsAt: string;
  purchaseWindowEndsAt: string | null;
  updatedAt: string;
}

export interface OrderStatusUpdatedEvent {
  orderId: string;
  sellerOrderId: string;
  sellerOrderStatus: SellerOrderStatus;
  aggregateOrderStatus: OrderStatus;
  updatedAt: string;
}

export interface SubscriptionAck {
  ok: boolean;
  room?: string;
  error?: string;
}
