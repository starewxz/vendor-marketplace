import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { CATALOG_SEARCH_PORT } from './search/catalog-search.interface';
import type {
  CatalogSearchPort,
  CatalogSearchResult,
} from './search/catalog-search.interface';
import { PostgresCatalogFallbackService } from './search/postgres-catalog-fallback.service';
import { buildProductSearchDocument } from './search/product-search-document';
import { generateUniqueSlug, isUniqueViolation } from '../../common/utils/slug';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { OutboxService } from '../outbox/outbox.service';

const PRODUCT_RELATIONS = {
  sellerProfile: true,
  category: true,
  auction: true,
} as const;
const MAX_SLUG_ATTEMPTS = 5;

/**
 * Deliberately has no dependency on BullMQ. Catalog writes here emit an
 * OutboxEvent inside the same DB transaction; a separate search-sync
 * consumer reacts to it. See README "Consistency model" for why this
 * service never calls Meilisearch directly on a write path.
 */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @Inject(CATALOG_SEARCH_PORT)
    private readonly catalogSearch: CatalogSearchPort,
    private readonly fallbackSearch: PostgresCatalogFallbackService,
    private readonly cache: CatalogCacheService,
    private readonly outboxService: OutboxService,
  ) {}

  // ---------------------------------------------------------------------
  // Public catalog (search-engine-first, Postgres fallback, cached)
  // ---------------------------------------------------------------------

  async searchCatalog(
    query: CatalogQueryDto,
    correlationId: string,
  ): Promise<CatalogSearchResult> {
    const version = await this.cache.getSearchVersion();
    const cacheKey = this.cache.buildSearchCacheKey(
      query as unknown as Record<string, unknown>,
      version,
    );

    const cached = await this.cache.getJson<CatalogSearchResult>(cacheKey);
    if (cached) return cached;

    let result: CatalogSearchResult;
    try {
      result = await this.catalogSearch.search(query);
    } catch (error) {
      this.logger.warn(
        `[${correlationId}] search engine unavailable, falling back to Postgres: ${(error as Error).message}`,
      );
      result = await this.fallbackSearch.search(query);
    }

    await this.cache.setJson(cacheKey, result, this.cache.searchCacheTtl());
    return result;
  }

  async findPublicById(id: string): Promise<Product> {
    const cacheKey = this.cache.productCacheKey(id);
    const cached = await this.cache.getJson<Product>(cacheKey);
    if (cached) return cached;

    const product = await this.productsRepository.findOne({
      where: { id, isPublished: true },
      relations: PRODUCT_RELATIONS,
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    await this.cache.setJson(cacheKey, product, this.cache.productCacheTtl());
    return product;
  }

  // ---------------------------------------------------------------------
  // Seller-owned CRUD — identity always comes from the caller, never a
  // client-supplied field. Ownership is enforced by scoping every lookup
  // to (id, sellerProfileId) so a mismatch is indistinguishable from
  // "doesn't exist" (404), never leaking that another seller's product id
  // is valid.
  // ---------------------------------------------------------------------

  findOwnedList(sellerProfileId: string): Promise<Product[]> {
    return this.productsRepository.find({
      where: { sellerProfileId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOwnedById(id: string, sellerProfileId: string): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id, sellerProfileId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async createForSeller(
    sellerProfileId: string,
    dto: CreateProductDto,
    correlationId: string,
  ): Promise<Product> {
    await this.assertCategoryExists(dto.categoryId);

    const product = await this.insertWithUniqueSlug(
      dto.name,
      async (slug, manager) => {
        const entity = manager.create(Product, {
          name: dto.name,
          description: dto.description ?? null,
          categoryId: dto.categoryId,
          type: dto.type,
          price: dto.price ?? null,
          stockQuantity: dto.stockQuantity,
          imageUrls: dto.imageUrls ?? [],
          isPublished: dto.isPublished ?? true,
          sellerProfileId,
          slug,
        });
        const saved = await manager.save(entity);
        await this.outboxService.record(manager, {
          eventType: 'PRODUCT_CREATED',
          aggregateType: 'Product',
          aggregateId: saved.id,
          payload: { productId: saved.id },
          correlationId,
        });
        return saved;
      },
    );

    await this.cache.invalidateSearch();
    this.logger.log(
      `[${correlationId}] product created productId=${product.id} sellerProfileId=${sellerProfileId}`,
    );
    return product;
  }

  async updateOwned(
    id: string,
    sellerProfileId: string,
    dto: UpdateProductDto,
    correlationId: string,
  ): Promise<Product> {
    const existing = await this.findOwnedById(id, sellerProfileId);
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const updated = await this.productsRepository.manager.transaction(
      async (manager) => {
        // UpdateProductDto has no slug field — the slug is set once at
        // creation and never changes on rename, keeping product URLs stable.
        manager.merge(Product, existing, dto);
        const saved = await manager.save(existing);
        await this.outboxService.record(manager, {
          eventType: 'PRODUCT_UPDATED',
          aggregateType: 'Product',
          aggregateId: saved.id,
          payload: { productId: saved.id },
          correlationId,
        });
        return saved;
      },
    );

    await this.cache.invalidateProduct(id);
    await this.cache.invalidateSearch();
    this.logger.log(
      `[${correlationId}] product updated productId=${id} sellerProfileId=${sellerProfileId}`,
    );
    return updated;
  }

  async deleteOwned(
    id: string,
    sellerProfileId: string,
    correlationId: string,
  ): Promise<void> {
    const existing = await this.findOwnedById(id, sellerProfileId);

    await this.productsRepository.manager.transaction(async (manager) => {
      await manager.remove(existing);
      await this.outboxService.record(manager, {
        eventType: 'PRODUCT_DELETED',
        aggregateType: 'Product',
        aggregateId: id,
        payload: { productId: id },
        correlationId,
      });
    });

    await this.cache.invalidateProduct(id);
    await this.cache.invalidateSearch();
    this.logger.log(
      `[${correlationId}] product deleted productId=${id} sellerProfileId=${sellerProfileId}`,
    );
  }

  /** Re-fetches the current row + relations and maps it to a search document — used by the search-sync consumer. */
  async loadSearchDocument(
    productId: string,
  ): Promise<ReturnType<typeof buildProductSearchDocument> | null> {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
      relations: PRODUCT_RELATIONS,
    });
    return product && product.isPublished
      ? buildProductSearchDocument(product)
      : null;
  }

  findManyByCategory(categoryId: string): Promise<Product[]> {
    return this.productsRepository.find({
      where: { categoryId },
      relations: PRODUCT_RELATIONS,
    });
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const exists = await this.categoriesRepository.exists({
      where: { id: categoryId },
    });
    if (!exists) {
      throw new BadRequestException(`Category ${categoryId} does not exist`);
    }
  }

  /**
   * Pre-checks a likely-unique slug, then attempts the insert inside its
   * own fresh transaction per try — a Postgres unique-violation aborts the
   * whole transaction it occurred in, so retrying must start a new one
   * rather than reusing the failed transaction's manager.
   */
  private async insertWithUniqueSlug(
    nameForSlug: string,
    insert: (slug: string, manager: EntityManager) => Promise<Product>,
  ): Promise<Product> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = await generateUniqueSlug(nameForSlug, async (candidate) => {
        const existing = await this.productsRepository.exists({
          where: { slug: candidate },
        });
        return existing;
      });

      try {
        return await this.productsRepository.manager.transaction((manager) =>
          insert(slug, manager),
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    this.logger.warn(
      `product create exhausted slug retries: ${(lastError as Error)?.message}`,
    );
    throw new ConflictException(
      `Could not generate a unique slug for "${nameForSlug}" — try a different name`,
    );
  }
}
