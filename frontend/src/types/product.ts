export type ProductType = 'FIXED_PRICE' | 'AUCTION';

/** Shape returned by the public catalog search (GET /products) — a flattened Meilisearch document. */
export interface CatalogProduct {
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
  productType: ProductType;
  rating: number;
  ratingCount: number;
  imageUrls: string[];
  createdAt: number;
}

/** Shape returned by the product detail read (GET /products/:id) — a Postgres entity with nested relations. */
export interface ProductDetail {
  id: string;
  sellerProfileId: string;
  categoryId: string;
  sellerProfile: { id: string; storeName: string; storeSlug: string };
  category: { id: string; name: string; slug: string };
  name: string;
  slug: string;
  description: string | null;
  type: ProductType;
  price: string | null;
  stockQuantity: number;
  imageUrls: string[];
  isPublished: boolean;
  ratingAverage: string;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Shape returned by seller-owned CRUD endpoints (/seller/products/*) — the raw entity, no relations loaded. */
export interface SellerProduct {
  id: string;
  sellerProfileId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  type: ProductType;
  price: string | null;
  stockQuantity: number;
  imageUrls: string[];
  isPublished: boolean;
  ratingAverage: string;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFormInput {
  name: string;
  description?: string;
  categoryId: string;
  type: ProductType;
  price?: string;
  stockQuantity: number;
  imageUrls?: string[];
  isPublished?: boolean;
}
