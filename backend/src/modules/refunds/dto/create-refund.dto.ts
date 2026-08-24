import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Deliberately has no `amount` field — the refund amount, commission
 * correction, and seller correction are always computed server-side from
 * the SellerOrderItem's immutable purchase snapshot, never accepted from
 * the client. See RefundsService.calculateRefund.
 */
export class CreateRefundDto {
  @ApiProperty()
  @IsUUID()
  sellerOrderItemId: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
