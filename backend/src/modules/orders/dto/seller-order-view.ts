import { ApiProperty } from '@nestjs/swagger';

export class SellerOrderItemView {
  @ApiProperty()
  productId: string | null;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  unitPrice: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  lineTotal: string;
}

export class SellerOrderListItemView {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  subtotal: string;

  @ApiProperty()
  commissionAmount: string;

  @ApiProperty()
  sellerNetAmount: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  itemCount: number;
}

export class SellerOrderDetailView {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  subtotal: string;

  @ApiProperty()
  commissionAmount: string;

  @ApiProperty()
  sellerNetAmount: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [SellerOrderItemView] })
  items: SellerOrderItemView[];

  // Needed for fulfillment — copied from the parent Order, which the
  // seller has no direct access to (only their own SellerOrder slice).
  @ApiProperty({ nullable: true })
  shippingAddressLine1: string | null;

  @ApiProperty({ nullable: true })
  shippingAddressLine2: string | null;

  @ApiProperty({ nullable: true })
  shippingCity: string | null;

  @ApiProperty({ nullable: true })
  shippingPostalCode: string | null;

  @ApiProperty({ nullable: true })
  shippingCountry: string | null;
}
