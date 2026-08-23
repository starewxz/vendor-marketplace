import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { createHash } from 'crypto';
import { REDIS_CLIENT } from '../redis/redis.module';

const SEARCH_VERSION_KEY = 'catalog:search:version';
// Short on purpose: the version bump on mutation invalidates *future*
// distinct queries immediately, but an identical query repeated within the
// TTL still replays whatever it first saw (including a "not indexed yet"
// miss) until this expires — keep that window close to the search-sync
// pipeline's own latency (outbox poll + Meilisearch task) so newly-created
// products don't look invisible for longer than they actually are.
const SEARCH_TTL_SECONDS = 5;
const PRODUCT_TTL_SECONDS = 60;
const CATEGORIES_TTL_SECONDS = 300;

/**
 * Caches public, non-personalized catalog reads only (search results,
 * product details, category list) — never seller-scoped dashboard data.
 * Search results are versioned rather than individually tracked: any
 * product/category mutation bumps a single counter, which changes every
 * subsequent search cache key and makes old entries unreachable (they just
 * expire naturally via TTL) — cheaper and simpler than enumerating and
 * deleting every cached query shape.
 *
 * Every method is failure-safe: a Redis outage degrades to "cache miss",
 * it never surfaces as an error to the caller (see task requirement that
 * Redis being down must not break catalog reads).
 */
@Injectable()
export class CatalogCacheService {
  private readonly logger = new Logger(CatalogCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getSearchVersion(): Promise<number> {
    const value = await this.safe(() => this.redis.get(SEARCH_VERSION_KEY));
    return value ? Number(value) : 1;
  }

  async bumpSearchVersion(): Promise<void> {
    await this.safe(() => this.redis.incr(SEARCH_VERSION_KEY));
  }

  buildSearchCacheKey(query: Record<string, unknown>, version: number): string {
    const normalized = JSON.stringify(query, Object.keys(query).sort());
    const hash = createHash('sha1').update(normalized).digest('hex');
    return `catalog:search:v${version}:${hash}`;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.safe(() => this.redis.get(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    await this.safe(() =>
      this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds),
    );
  }

  searchCacheTtl(): number {
    return SEARCH_TTL_SECONDS;
  }

  productCacheKey(productId: string): string {
    return `catalog:product:${productId}`;
  }

  async invalidateProduct(productId: string): Promise<void> {
    await this.safe(() => this.redis.del(this.productCacheKey(productId)));
  }

  productCacheTtl(): number {
    return PRODUCT_TTL_SECONDS;
  }

  categoriesCacheKey(): string {
    return 'catalog:categories';
  }

  async invalidateCategories(): Promise<void> {
    await this.safe(() => this.redis.del(this.categoriesCacheKey()));
  }

  categoriesCacheTtl(): number {
    return CATEGORIES_TTL_SECONDS;
  }

  /** Any product or category write invalidates search results — both can change what a query returns. */
  async invalidateSearch(): Promise<void> {
    await this.bumpSearchVersion();
  }

  private async safe<T>(op: () => Promise<T>): Promise<T | null> {
    try {
      return await op();
    } catch (error) {
      this.logger.warn(
        `Redis cache operation failed, degrading to cache-miss: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
