import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

const PRICE_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Deliberately excludes productId — an auction never moves to a different
 * product. Every field here is only accepted while the auction still has
 * zero bids (see SellerAuctionsService.update / "post-first-bid
 * immutability"); once a first bid lands, none of these can change without
 * invalidating a bidder's expectation of the terms they bid under.
 */
export class UpdateAuctionDto {
  @ApiPropertyOptional({ example: '10.00' })
  @IsOptional()
  @IsString()
  @Matches(PRICE_REGEX, {
    message:
      'startPrice must be a non-negative number with at most 2 decimal places',
  })
  startPrice?: string;

  @ApiPropertyOptional({ example: '1.00' })
  @IsOptional()
  @IsString()
  @Matches(PRICE_REGEX, {
    message:
      'minBidIncrement must be a non-negative number with at most 2 decimal places',
  })
  minBidIncrement?: string;

  @ApiPropertyOptional({ example: '2026-08-25T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-08-26T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
