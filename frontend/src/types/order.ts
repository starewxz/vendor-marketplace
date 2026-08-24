export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Deliberately omits commissionAmount/sellerNetAmount — buyer-facing view only. */
export interface CustomerOrderItemView {
  productId: string | null;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface CustomerSellerOrderView {
  id: string;
  storeName: string;
  status: string;
  subtotal: string;
  items: CustomerOrderItemView[];
}

export interface CustomerOrderListItemView {
  id: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  sellerCount: number;
}

export interface CustomerOrderDetailView {
  id: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  sellerOrders: CustomerSellerOrderView[];
}

export interface SellerOrderItemView {
  productId: string | null;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface SellerOrderListItemView {
  id: string;
  orderId: string;
  status: string;
  subtotal: string;
  commissionAmount: string;
  sellerNetAmount: string;
  createdAt: string;
  itemCount: number;
}

export interface SellerOrderDetailView {
  id: string;
  orderId: string;
  status: string;
  subtotal: string;
  commissionAmount: string;
  sellerNetAmount: string;
  createdAt: string;
  items: SellerOrderItemView[];
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
}

export interface AdminOrderItemView {
  productId: string | null;
  productName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface AdminSellerOrderView {
  id: string;
  sellerProfileId: string;
  storeName: string;
  status: string;
  subtotal: string;
  commissionAmount: string;
  sellerNetAmount: string;
  items: AdminOrderItemView[];
}

export interface AdminOrderListItemView {
  id: string;
  buyerId: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  sellerOrderCount: number;
}

export interface AdminOrderDetailView {
  id: string;
  buyerId: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  sellerOrders: AdminSellerOrderView[];
}
