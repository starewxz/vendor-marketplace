export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type SellerOrderStatus =
  | 'AWAITING_FULFILLMENT'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

/** Parent Order status — always derived from every SellerOrder under it. */
export type OrderStatus =
  | 'NEW'
  | 'PROCESSING'
  | 'PARTIALLY_SHIPPED'
  | 'SHIPPED'
  | 'PARTIALLY_COMPLETED'
  | 'COMPLETED'
  | 'PARTIALLY_CANCELLED'
  | 'CANCELLED';

export interface SellerOrderFinancialSummaryView {
  originalSubtotal: string;
  originalCommission: string;
  originalSellerNet: string;
  refundedAmount: string;
  commissionReversed: string;
  sellerNetReversed: string;
  effectiveSubtotal: string;
  effectiveCommission: string;
  effectiveSellerNet: string;
}

export interface RefundView {
  id: string;
  sellerOrderItemId: string;
  quantity: number;
  amount: string;
  commissionAdjustment: string;
  sellerAdjustment: string;
  reason: string | null;
  status: string;
  createdAt: string;
}

/** Deliberately omits commissionAmount/sellerNetAmount — buyer-facing view only. */
export interface CustomerOrderItemView {
  productId: string | null;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  refundedQuantity: number;
}

export interface CustomerSellerOrderView {
  id: string;
  storeName: string;
  status: SellerOrderStatus;
  subtotal: string;
  refundedAmount: string;
  items: CustomerOrderItemView[];
}

export interface CustomerOrderListItemView {
  id: string;
  status: OrderStatus;
  totalAmount: string;
  createdAt: string;
  sellerCount: number;
}

export interface CustomerOrderDetailView {
  id: string;
  status: OrderStatus;
  originalTotal: string;
  refundedTotal: string;
  effectiveTotal: string;
  createdAt: string;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  sellerOrders: CustomerSellerOrderView[];
}

export interface SellerOrderItemView {
  id: string;
  productId: string | null;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  refundedQuantity: number;
}

export interface SellerOrderListItemView {
  id: string;
  orderId: string;
  status: SellerOrderStatus;
  subtotal: string;
  commissionAmount: string;
  sellerNetAmount: string;
  createdAt: string;
  itemCount: number;
}

export interface SellerOrderDetailView {
  id: string;
  orderId: string;
  status: SellerOrderStatus;
  subtotal: string;
  commissionAmount: string;
  sellerNetAmount: string;
  financials: SellerOrderFinancialSummaryView;
  createdAt: string;
  items: SellerOrderItemView[];
  refunds: RefundView[];
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
}

export interface AdminOrderItemView {
  id: string;
  productId: string | null;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  refundedQuantity: number;
}

export interface AdminSellerOrderView {
  id: string;
  sellerProfileId: string;
  storeName: string;
  status: SellerOrderStatus;
  subtotal: string;
  commissionAmount: string;
  sellerNetAmount: string;
  financials: SellerOrderFinancialSummaryView;
  items: AdminOrderItemView[];
  refunds: RefundView[];
}

export interface AdminOrderListItemView {
  id: string;
  buyerId: string;
  status: OrderStatus;
  totalAmount: string;
  createdAt: string;
  sellerOrderCount: number;
}

export interface AdminOrderDetailView {
  id: string;
  buyerId: string;
  status: OrderStatus;
  originalTotal: string;
  refundedTotal: string;
  effectiveTotal: string;
  createdAt: string;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  sellerOrders: AdminSellerOrderView[];
}
