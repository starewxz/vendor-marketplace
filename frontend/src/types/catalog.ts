import type { CatalogProduct, ProductType } from './product';

export interface CatalogQuery {
  search?: string;
  categoryId?: string;
  sellerId?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  available?: boolean;
  type?: ProductType;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface CatalogSearchResult {
  data: CatalogProduct[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  facets?: Record<string, Record<string, number>>;
}
