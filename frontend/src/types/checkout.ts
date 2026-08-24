export interface CheckoutShippingInput {
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
}

export interface CheckoutSellerOrderResult {
  id: string;
  sellerProfileId: string;
  subtotal: string;
  commissionAmount: string;
  sellerNetAmount: string;
  status: string;
}

export interface CheckoutResult {
  orderId: string;
  status: string;
  totalAmount: string;
  sellerOrders: CheckoutSellerOrderResult[];
  replayed: boolean;
}
