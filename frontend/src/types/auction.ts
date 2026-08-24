export type AuctionStatus =
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'ENDED'
  | 'UNSOLD'
  | 'EXPIRED'
  | 'AWAITING_PAYMENT'
  | 'COMPLETED'
  | 'CANCELLED';

export interface AuctionView {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  startPrice: string;
  currentPrice: string;
  minBidIncrement: string;
  minNextBid: string;
  startsAt: string;
  endsAt: string;
  status: AuctionStatus;
  bidCount: number;
  purchaseWindowEndsAt: string | null;
}

export interface SellerAuction extends AuctionView {
  isEditable: boolean;
  winnerId: string | null;
}

export interface BidHistoryItem {
  id: string;
  amount: string;
  createdAt: string;
  bidderLabel: string;
  isMine: boolean;
}

export interface BidAccepted {
  bidId: string;
  auctionId: string;
  amount: string;
  currentPrice: string;
  minimumNextBid: string;
  createdAt: string;
}

export interface AuctionWinnerState {
  isWinner: boolean;
  canCheckout: boolean;
  purchaseWindowEndsAt: string | null;
}

export interface AuctionInput {
  productId: string;
  startPrice: string;
  minBidIncrement: string;
  startsAt: string;
  endsAt: string;
}

export interface AuctionCheckoutResult {
  orderId: string;
  sellerOrderId: string;
  totalAmount: string;
  replayed: boolean;
}

export interface PaginatedAuctions {
  data: SellerAuction[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
