import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SellerOrderStatus } from '../entities/seller-order-status.enum';

export class UpdateSellerOrderStatusDto {
  @ApiProperty({
    enum: SellerOrderStatus,
    description:
      'Target status. Only forward transitions are valid (AWAITING_FULFILLMENT -> PROCESSING -> SHIPPED -> DELIVERED); CANCELLED is rejected here — use the dedicated cancel endpoint instead.',
  })
  @IsEnum(SellerOrderStatus)
  status: SellerOrderStatus;
}
