import { ProductType } from '../entities/product-type.enum';
import { ProductSearchDocument } from './product-search-document';

export interface CatalogSearchQuery {
  search?: string;
  categoryId?: string;
  sellerId?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  available?: boolean;
  type?: ProductType;
  page: number;
  pageSize: number;
  sort?: string;
}

export interface CatalogSearchResult {
  data: ProductSearchDocument[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  facets?: Record<string, Record<string, number>>;
}

/**
 * High-level catalog search contract — the thing ProductsService/CatalogService
 * actually depends on. Keeps query building, facet configuration, and result
 * shaping out of business logic; only MeilisearchCatalogSearchService knows
 * this is backed by Meilisearch under `SEARCH_INDEX_PORT`.
 *
 * This does NOT catch/hide search-engine failures — callers decide whether
 * and how to fall back (see ProductsService's Postgres fallback).
 */
export interface CatalogSearchPort {
  search(query: CatalogSearchQuery): Promise<CatalogSearchResult>;
}

export const CATALOG_SEARCH_PORT = Symbol('CATALOG_SEARCH_PORT');
