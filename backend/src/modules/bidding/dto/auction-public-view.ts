import { ApiProperty } from '@nestjs/swagger';
import { AuctionStatus } from '../entities/auction-status.enum';

/**
 * Deliberately omits bidderId/winnerId — public callers only ever see
 * aggregate state (current price, status, deadline, bid count), never who
 * placed a bid. See BidHistoryItemView for the anonymized per-bid shape.
 */
export class AuctionPublicView {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  productSlug: string;

  @ApiProperty()
  startPrice: string;

  @ApiProperty()
  currentPrice: string;

  @ApiProperty()
  minBidIncrement: string;

  @ApiProperty()
  minNextBid: string;

  @ApiProperty()
  startsAt: Date;

  @ApiProperty()
  endsAt: Date;

  @ApiProperty({ enum: AuctionStatus })
  status: AuctionStatus;

  @ApiProperty()
  bidCount: number;

  @ApiProperty({ nullable: true })
  purchaseWindowEndsAt: Date | null;
}

export class AuctionWinnerStateView {
  @ApiProperty()
  isWinner: boolean;

  @ApiProperty()
  canCheckout: boolean;

  @ApiProperty({ nullable: true })
  purchaseWindowEndsAt: Date | null;
}

export class BidAcceptedView {
  @ApiProperty()
  bidId: string;

  @ApiProperty()
  auctionId: string;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  currentPrice: string;

  @ApiProperty()
  minimumNextBid: string;

  @ApiProperty()
  createdAt: Date;
}
