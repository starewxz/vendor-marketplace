import { ApiProperty } from '@nestjs/swagger';

export class CheckoutSellerOrderResult {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sellerProfileId: string;

  @ApiProperty()
  subtotal: string;

  @ApiProperty()
  commissionAmount: string;

  @ApiProperty()
  sellerNetAmount: string;

  @ApiProperty()
  status: string;
}

export class CheckoutResult {
  @ApiProperty()
  orderId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalAmount: string;

  @ApiProperty({ type: [CheckoutSellerOrderResult] })
  sellerOrders: CheckoutSellerOrderResult[];

  @ApiProperty({
    description:
      'True when this response is a replay of a previously completed checkout for the same Idempotency-Key, not a new order.',
  })
  replayed: boolean;
}
