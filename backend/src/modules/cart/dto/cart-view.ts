import { ApiProperty } from '@nestjs/swagger';

/**
 * Read model for GET /cart and every cart mutation response. Grouped by
 * seller because checkout later splits one cart into one SellerOrder per
 * seller — the frontend cart view mirrors that split up front rather than
 * flattening it, so the customer sees the same grouping they'll get an
 * order confirmation for.
 *
 * Prices here are live (joined from Product at read time), not snapshots —
 * only the checkout transaction freezes prices into SellerOrderItem rows.
 */
export class CartItemView {
  @ApiProperty()
  productId: string;

  @ApiProperty()
  productName: string;

  @ApiProperty({ nullable: true })
  imageUrl: string | null;

  @ApiProperty({ description: 'Current unit price, decimal string' })
  unitPrice: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ description: 'unitPrice * quantity, decimal string' })
  lineTotal: string;

  @ApiProperty({ description: 'Current stock available for this product' })
  availableStock: number;
}

export class CartSellerGroup {
  @ApiProperty()
  sellerProfileId: string;

  @ApiProperty()
  storeName: string;

  @ApiProperty({ type: [CartItemView] })
  items: CartItemView[];

  @ApiProperty({ description: "Sum of this seller group's line totals" })
  subtotal: string;
}

export class CartView {
  @ApiProperty({ type: [CartSellerGroup] })
  sellers: CartSellerGroup[];

  @ApiProperty()
  itemCount: number;

  @ApiProperty({ description: "Sum of all sellers' subtotals" })
  totalAmount: string;
}
