import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

const PRICE_REGEX = /^\d+(\.\d{1,2})?$/;

export class PlaceBidDto {
  @ApiProperty({ example: '55.00' })
  @IsString()
  @Matches(PRICE_REGEX, {
    message:
      'amount must be a non-negative number with at most 2 decimal places',
  })
  amount: string;
}
