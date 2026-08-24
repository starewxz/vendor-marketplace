import { ApiProperty } from '@nestjs/swagger';

/**
 * `bidderLabel` is a stable per-auction anonymized tag ("Bidder 1", "Bidder
 * 2", ...) assigned by first-appearance order — never the real bidderId.
 * `isMine` is only ever true for the authenticated caller's own bids; it's
 * always false on an unauthenticated request.
 */
export class BidHistoryItemView {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  bidderLabel: string;

  @ApiProperty()
  isMine: boolean;
}
