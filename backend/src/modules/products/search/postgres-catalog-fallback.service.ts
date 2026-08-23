import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import {
  CatalogSearchQuery,
  CatalogSearchResult,
} from './catalog-search.interface';
import { buildProductSearchDocument } from './product-search-document';

/**
 * Used when Meilisearch is unavailable (see ProductsService.searchCatalog).
 * Trades full-text relevance and facets for guaranteed availability: name
 * search degrades to a trigram-indexed ILIKE (see migration for the
 * pg_trgm index), and no facet counts are computed — the catalog stays
 * browsable rather than returning a 500.
 */
@Injectable()
export class PostgresCatalogFallbackService {
  private readonly logger = new Logger(PostgresCatalogFallbackService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async search(query: CatalogSearchQuery): Promise<CatalogSearchResult> {
    const qb = this.productsRepository
      .createQueryBuilder('product')
      .innerJoinAndSelect('product.sellerProfile', 'sellerProfile')
      .innerJoinAndSelect('product.category', 'category')
      .where('product.isPublished = true');

    if (query.search) {
      qb.andWhere('product.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }
    if (query.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.sellerId) {
      qb.andWhere('product.sellerProfileId = :sellerId', {
        sellerId: query.sellerId,
      });
    }
    if (query.type) {
      qb.andWhere('product.type = :type', { type: query.type });
    }
    if (query.minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: query.minPrice });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: query.maxPrice });
    }
    if (query.minRating !== undefined) {
      qb.andWhere('product.ratingAverage >= :minRating', {
        minRating: query.minRating,
      });
    }
    if (query.available !== undefined) {
      qb.andWhere(
        query.available
          ? 'product.stockQuantity > 0'
          : 'product.stockQuantity = 0',
      );
    }

    qb.orderBy(...this.resolveSort(query.sort));
    qb.skip((query.page - 1) * query.pageSize).take(query.pageSize);

    const [products, total] = await qb.getManyAndCount();

    this.logger.warn(
      `Search fallback used (Meilisearch unavailable): page=${query.page} results=${products.length}/${total}`,
    );

    return {
      data: products.map(buildProductSearchDocument),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      // Facets require a search engine's aggregation; omitted here rather
      // than run several extra COUNT(*) GROUP BY queries per request.
      facets: undefined,
    };
  }

  private resolveSort(sort: string | undefined): [string, 'ASC' | 'DESC'] {
    if (!sort) return ['product.createdAt', 'DESC'];
    const [field, direction] = sort.split(':');
    const column = {
      price: 'product.price',
      createdAt: 'product.createdAt',
      rating: 'product.ratingAverage',
    }[field];
    return [
      column ?? 'product.createdAt',
      direction === 'asc' ? 'ASC' : 'DESC',
    ];
  }
}
