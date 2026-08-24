import { ApiProperty } from '@nestjs/swagger';
import {
  SellerOrderFinancialSummaryView,
  SellerOrderItemView,
  SellerOrderRefundView,
} from './seller-order-view';

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

  @ApiProperty({ type: SellerOrderFinancialSummaryView })
  financials: SellerOrderFinancialSummaryView;

  @ApiProperty({ type: [SellerOrderItemView] })
  items: SellerOrderItemView[];

  @ApiProperty({ type: [SellerOrderRefundView] })
  refunds: SellerOrderRefundView[];
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
  originalTotal: string;

  @ApiProperty()
  refundedTotal: string;

  @ApiProperty()
  effectiveTotal: string;

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
