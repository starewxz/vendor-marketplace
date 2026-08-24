import { ApiProperty } from '@nestjs/swagger';

export class SellerOrderItemView {
  @ApiProperty()
  id: string;

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

  @ApiProperty({
    description: 'Sum of COMPLETED refund quantities against this line item',
  })
  refundedQuantity: number;
}

export class SellerOrderRefundView {
  @ApiProperty()
  id: string;

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

/** See domain/financial-summary.ts — always derived, never stored. */
export class SellerOrderFinancialSummaryView {
  @ApiProperty()
  originalSubtotal: string;

  @ApiProperty()
  originalCommission: string;

  @ApiProperty()
  originalSellerNet: string;

  @ApiProperty()
  refundedAmount: string;

  @ApiProperty()
  commissionReversed: string;

  @ApiProperty()
  sellerNetReversed: string;

  @ApiProperty()
  effectiveSubtotal: string;

  @ApiProperty()
  effectiveCommission: string;

  @ApiProperty()
  effectiveSellerNet: string;
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

  @ApiProperty({ type: SellerOrderFinancialSummaryView })
  financials: SellerOrderFinancialSummaryView;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [SellerOrderItemView] })
  items: SellerOrderItemView[];

  @ApiProperty({ type: [SellerOrderRefundView] })
  refunds: SellerOrderRefundView[];

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
