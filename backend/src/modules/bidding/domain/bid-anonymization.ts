import { Bid } from '../entities/bid.entity';
import { BidHistoryItemView } from '../dto/bid-history-item-view';

/**
 * Assigns each distinct bidder a stable "Bidder N" label by order of first
 * appearance in `bids` (which must already be sorted oldest-first) — never
 * the real bidderId. `currentUserId` is optional (unauthenticated callers
 * get isMine: false on every row).
 */
export function anonymizeBidHistory(
  bids: Bid[],
  currentUserId: string | undefined,
): BidHistoryItemView[] {
  const labelByBidder = new Map<string, string>();

  return bids.map((bid) => {
    let label = labelByBidder.get(bid.bidderId);
    if (!label) {
      label = `Bidder ${labelByBidder.size + 1}`;
      labelByBidder.set(bid.bidderId, label);
    }
    return {
      id: bid.id,
      amount: bid.amount,
      createdAt: bid.createdAt,
      bidderLabel: label,
      isMine: currentUserId !== undefined && bid.bidderId === currentUserId,
    };
  });
}
