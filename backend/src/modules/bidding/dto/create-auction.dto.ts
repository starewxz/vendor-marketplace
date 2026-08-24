import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, IsUUID, Matches } from 'class-validator';

/** Non-negative decimal with up to 2 fraction digits — matches the numeric(12,2) column. */
const PRICE_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * The seller must already own an AUCTION-type Product (created via the
 * existing POST /seller/products, ProductType.AUCTION) before creating its
 * Auction — one auction per product, enforced by the unique index on
 * Auction.productId.
 */
export class CreateAuctionDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: '10.00' })
  @IsString()
  @Matches(PRICE_REGEX, {
    message:
      'startPrice must be a non-negative number with at most 2 decimal places',
  })
  startPrice: string;

  @ApiProperty({ example: '1.00' })
  @IsString()
  @Matches(PRICE_REGEX, {
    message:
      'minBidIncrement must be a non-negative number with at most 2 decimal places',
  })
  minBidIncrement: string;

  @ApiProperty({ example: '2026-08-25T12:00:00.000Z' })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ example: '2026-08-26T12:00:00.000Z' })
  @IsDateString()
  endsAt: string;
}
