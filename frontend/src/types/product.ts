export type ProductType = 'FIXED_PRICE' | 'AUCTION';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: ProductType;
  price: string | null;
  stockQuantity: number;
  imageUrls: string[];
  isPublished: boolean;
}
