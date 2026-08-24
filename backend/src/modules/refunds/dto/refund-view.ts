import { ApiProperty } from '@nestjs/swagger';

export class RefundView {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sellerOrderId: string;

  @ApiProperty()
  sellerOrderItemId: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  commissionAdjustment: string;

  @ApiProperty()
  sellerAdjustment: string;

  @ApiProperty({ nullable: true })
  reason: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}
