import { ApiProperty } from '@nestjs/swagger';

export class AdminOrderItemView {
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

/** Full financial visibility — admin sees every seller's split on the order. */
export class AdminSellerOrderView {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sellerProfileId: string;

  @ApiProperty()
  storeName: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  subtotal: string;

  @ApiProperty()
  commissionAmount: string;

  @ApiProperty()
  sellerNetAmount: string;

  @ApiProperty({ type: [AdminOrderItemView] })
  items: AdminOrderItemView[];
}

export class AdminOrderListItemView {
  @ApiProperty()
  id: string;

  @ApiProperty()
  buyerId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalAmount: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  sellerOrderCount: number;
}

export class AdminOrderDetailView {
  @ApiProperty()
  id: string;

  @ApiProperty()
  buyerId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalAmount: string;

  @ApiProperty()
  createdAt: Date;

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

  @ApiProperty({ type: [AdminSellerOrderView] })
  sellerOrders: AdminSellerOrderView[];
}
