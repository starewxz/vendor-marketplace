export interface CartItemView {
  productId: string;
  productName: string;
  imageUrl: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  availableStock: number;
}

export interface CartSellerGroup {
  sellerProfileId: string;
  storeName: string;
  items: CartItemView[];
  subtotal: string;
}

export interface CartView {
  sellers: CartSellerGroup[];
  itemCount: number;
  totalAmount: string;
}
