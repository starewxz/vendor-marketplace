import { ApiProperty } from '@nestjs/swagger';
import { AuctionPublicView } from './auction-public-view';

/**
 * Everything a seller/admin can see about their own auction beyond the
 * public view: whether it can still be edited (no bids yet) and, once a
 * winner exists, that winner's user id — the seller already sees the same
 * buyer identity on the resulting SellerOrder once purchased, so surfacing
 * it here isn't a new exposure, just earlier visibility into who to expect.
 */
export class AuctionSellerView extends AuctionPublicView {
  @ApiProperty()
  isEditable: boolean;

  @ApiProperty({ nullable: true })
  winnerId: string | null;
}
