import { Product } from '../entities/product.entity';

/**
 * The Meilisearch read model for a product. Deliberately excludes anything
 * seller-private (no email, no commission rate, no internal ids beyond what
 * the catalog UI needs) — this is a public-facing document.
 */
export interface ProductSearchDocument extends Record<string, unknown> {
  id: string;
  sellerId: string;
  sellerName: string;
  categoryId: string;
  categoryName: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | null;
  stockQuantity: number;
  available: boolean;
  productType: string;
  rating: number;
  ratingCount: number;
  imageUrls: string[];
  createdAt: number;
}

/** Requires `product.sellerProfile` and `product.category` to be loaded. */
export function buildProductSearchDocument(
  product: Product,
): ProductSearchDocument {
  return {
    id: product.id,
    sellerId: product.sellerProfileId,
    sellerName: product.sellerProfile.storeName,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price !== null ? Number(product.price) : null,
    stockQuantity: product.stockQuantity,
    available: product.stockQuantity > 0,
    productType: product.type,
    rating: Number(product.ratingAverage),
    ratingCount: product.ratingCount,
    imageUrls: product.imageUrls,
    createdAt: product.createdAt.getTime(),
  };
}
