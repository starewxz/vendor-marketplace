import { Auction } from '../entities/auction.entity';
import { AuctionPublicView } from '../dto/auction-public-view';
import { AuctionSellerView } from '../dto/auction-seller-view';
import { AuctionStatus } from '../entities/auction-status.enum';
import {
  parseMoneyToCents,
  formatCentsToMoney,
  sumCents,
} from '../../../common/utils/money';

/** Auction.product must be loaded before calling this. */
export function toPublicView(
  auction: Auction,
  bidCount: number,
): AuctionPublicView {
  const minNextBidCents =
    bidCount === 0
      ? parseMoneyToCents(auction.startPrice)
      : sumCents([
          parseMoneyToCents(auction.currentPrice),
          parseMoneyToCents(auction.minBidIncrement),
        ]);

  const now = Date.now();
  const effectiveStatus =
    auction.status === AuctionStatus.SCHEDULED &&
    now >= auction.startsAt.getTime() &&
    now < auction.endsAt.getTime()
      ? AuctionStatus.ACTIVE
      : auction.status;

  return {
    id: auction.id,
    productId: auction.productId,
    productName: auction.product.name,
    productSlug: auction.product.slug,
    startPrice: auction.startPrice,
    currentPrice: auction.currentPrice,
    minBidIncrement: auction.minBidIncrement,
    minNextBid: formatCentsToMoney(minNextBidCents),
    startsAt: auction.startsAt,
    endsAt: auction.endsAt,
    status: effectiveStatus,
    bidCount,
    purchaseWindowEndsAt: auction.purchaseWindowEndsAt,
    updatedAt: auction.updatedAt,
  };
}

export function toSellerView(
  auction: Auction,
  bidCount: number,
  isEditable: boolean,
): AuctionSellerView {
  return {
    ...toPublicView(auction, bidCount),
    isEditable,
    winnerId: auction.winnerId,
  };
}
