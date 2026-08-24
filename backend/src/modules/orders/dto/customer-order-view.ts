import { ApiProperty } from '@nestjs/swagger';

/**
 * Deliberately omits commissionAmount/sellerNetAmount — that split is
 * platform/seller financial detail, not something the buyer needs to see.
 * The buyer only ever sees what they paid.
 */
export class CustomerOrderItemView {
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

export class CustomerSellerOrderView {
  @ApiProperty()
  id: string;

  @ApiProperty()
  storeName: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  subtotal: string;

  @ApiProperty({ type: [CustomerOrderItemView] })
  items: CustomerOrderItemView[];
}

export class CustomerOrderListItemView {
  @ApiProperty()
  id: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalAmount: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  sellerCount: number;
}

export class CustomerOrderDetailView {
  @ApiProperty()
  id: string;

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

  @ApiProperty({ type: [CustomerSellerOrderView] })
  sellerOrders: CustomerSellerOrderView[];
}
