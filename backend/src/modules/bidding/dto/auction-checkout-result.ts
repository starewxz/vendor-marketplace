import { ApiProperty } from '@nestjs/swagger';

export class AuctionCheckoutResult {
  @ApiProperty()
  orderId: string;

  @ApiProperty()
  sellerOrderId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalAmount: string;

  @ApiProperty({
    description:
      'True when this response is a replay of a previously completed purchase for the same Idempotency-Key, not a new order.',
  })
  replayed: boolean;
}
