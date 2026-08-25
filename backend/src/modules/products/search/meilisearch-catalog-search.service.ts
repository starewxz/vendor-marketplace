import { Inject, Injectable } from '@nestjs/common';
import { SEARCH_INDEX_PORT } from '../../../search/search-index.interface';
import type { SearchIndexPort } from '../../../search/search-index.interface';
import { PRODUCTS_INDEX } from './catalog-search.constants';
import type {
  CatalogSearchPort,
  CatalogSearchQuery,
  CatalogSearchResult,
} from './catalog-search.interface';
import type { ProductSearchDocument } from './product-search-document';

// price is a continuous field (filterable via price range, not faceted —
// per-exact-value counts wouldn't be meaningful); rating is discrete (1-5)
// so it's included here alongside the other faceted dimensions.
const FACETED_FIELDS = [
  'categoryId',
  'sellerId',
  'available',
  'productType',
  'rating',
];

@Injectable()
export class MeilisearchCatalogSearchService implements CatalogSearchPort {
  constructor(
    @Inject(SEARCH_INDEX_PORT) private readonly searchIndex: SearchIndexPort,
  ) {}

  async search(query: CatalogSearchQuery): Promise<CatalogSearchResult> {
    const filter = this.buildFilter(query);
    const offset = (query.page - 1) * query.pageSize;

    const result = await this.searchIndex.search<ProductSearchDocument>(
      PRODUCTS_INDEX,
      query.search ?? '',
      {
        limit: query.pageSize,
        offset,
        filter: filter.length > 0 ? filter.join(' AND ') : undefined,
        sort: query.sort ? [this.normalizeSort(query.sort)] : undefined,
        facets: FACETED_FIELDS,
      },
    );

    const total = result.estimatedTotalHits;
    return {
      data: result.hits,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      facets: result.facetDistribution,
    };
  }

  private buildFilter(query: CatalogSearchQuery): string[] {
    const clauses: string[] = [];
    if (query.categoryId) clauses.push(`categoryId = "${query.categoryId}"`);
    if (query.sellerId) clauses.push(`sellerId = "${query.sellerId}"`);
    if (query.type) clauses.push(`productType = "${query.type}"`);
    if (query.available !== undefined)
      clauses.push(`available = ${query.available}`);
    if (query.minPrice !== undefined)
      clauses.push(`price >= ${query.minPrice}`);
    if (query.maxPrice !== undefined)
      clauses.push(`price <= ${query.maxPrice}`);
    if (query.minRating !== undefined)
      clauses.push(`rating >= ${query.minRating}`);
    return clauses;
  }

  /** Accepts both "price:asc" (Meilisearch native) and "price-asc" (URL-friendlier) forms. */
  private normalizeSort(sort: string): string {
    return sort.replace('-', ':');
  }
}
