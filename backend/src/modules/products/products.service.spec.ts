/* eslint-disable @typescript-eslint/no-unsafe-return -- jest.fn() mock typing */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { CATALOG_SEARCH_PORT } from './search/catalog-search.interface';
import { PostgresCatalogFallbackService } from './search/postgres-catalog-fallback.service';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { OutboxService } from '../outbox/outbox.service';
import { ProductType } from './entities/product-type.enum';

describe('ProductsService', () => {
  let service: ProductsService;
  let productsRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    exists: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let categoriesRepository: { exists: jest.Mock };
  let catalogSearch: { search: jest.Mock };
  let fallbackSearch: { search: jest.Mock };
  let cache: {
    getSearchVersion: jest.Mock;
    buildSearchCacheKey: jest.Mock;
    getJson: jest.Mock;
    setJson: jest.Mock;
    searchCacheTtl: jest.Mock;
    productCacheKey: jest.Mock;
    productCacheTtl: jest.Mock;
    invalidateProduct: jest.Mock;
    invalidateSearch: jest.Mock;
  };
  let fakeManager: {
    create: jest.Mock;
    save: jest.Mock;
    merge: jest.Mock;
    remove: jest.Mock;
  };
  let outboxService: { record: jest.Mock };

  beforeEach(async () => {
    fakeManager = {
      create: jest.fn((_e, data) => data),
      save: jest.fn((x) => x),
      merge: jest.fn((_e, target, source) => Object.assign(target, source)),
      remove: jest.fn((x) => x),
    };
    productsRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      manager: {
        transaction: jest.fn((cb: (m: unknown) => unknown) => cb(fakeManager)),
      },
    };
    categoriesRepository = { exists: jest.fn().mockResolvedValue(true) };
    catalogSearch = { search: jest.fn() };
    fallbackSearch = { search: jest.fn() };
    cache = {
      getSearchVersion: jest.fn().mockResolvedValue(1),
      buildSearchCacheKey: jest.fn().mockReturnValue('cache-key'),
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn(),
      searchCacheTtl: jest.fn().mockReturnValue(30),
      productCacheKey: jest.fn((id: string) => `catalog:product:${id}`),
      productCacheTtl: jest.fn().mockReturnValue(60),
      invalidateProduct: jest.fn(),
      invalidateSearch: jest.fn(),
    };
    outboxService = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: productsRepository },
        {
          provide: getRepositoryToken(Category),
          useValue: categoriesRepository,
        },
        { provide: CATALOG_SEARCH_PORT, useValue: catalogSearch },
        { provide: PostgresCatalogFallbackService, useValue: fallbackSearch },
        { provide: CatalogCacheService, useValue: cache },
        { provide: OutboxService, useValue: outboxService },
      ],
    }).compile();

    service = moduleRef.get(ProductsService);
  });

  describe('ownership', () => {
    it('returns a product scoped to (id, sellerProfileId)', async () => {
      productsRepository.findOne.mockResolvedValue({
        id: 'p1',
        sellerProfileId: 'seller-a',
      });
      const product = await service.findOwnedById('p1', 'seller-a');
      expect(product.id).toBe('p1');
      expect(productsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'p1', sellerProfileId: 'seller-a' },
      });
    });

    it('404s when the product belongs to a different seller (IDOR-safe: no existence leak)', async () => {
      productsRepository.findOne.mockResolvedValue(null); // WHERE (id, sellerProfileId) matched nothing
      await expect(
        service.findOwnedById('p1', 'seller-b'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createForSeller', () => {
    it('rejects a nonexistent category', async () => {
      categoriesRepository.exists.mockResolvedValue(false);
      await expect(
        service.createForSeller(
          'seller-a',
          {
            name: 'Widget',
            categoryId: 'missing-category',
            type: ProductType.FIXED_PRICE,
            price: '9.99',
            stockQuantity: 1,
          },
          'corr-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('records a PRODUCT_CREATED outbox event in the same transaction and bumps the search cache', async () => {
      const product = await service.createForSeller(
        'seller-a',
        {
          name: 'Widget',
          categoryId: 'cat-1',
          type: ProductType.FIXED_PRICE,
          price: '9.99',
          stockQuantity: 3,
        },
        'corr-1',
      );

      expect(product.slug).toBe('widget');
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({ eventType: 'PRODUCT_CREATED' }),
      );
      expect(cache.invalidateSearch).toHaveBeenCalled();
    });
  });

  describe('searchCatalog', () => {
    const query = { page: 1, pageSize: 20 };

    it('returns a cached result without touching the search engine', async () => {
      cache.getJson.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      });
      await service.searchCatalog(query, 'corr-1');
      expect(catalogSearch.search).not.toHaveBeenCalled();
    });

    it('uses Meilisearch when it succeeds', async () => {
      catalogSearch.search.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      });
      await service.searchCatalog(query, 'corr-1');
      expect(catalogSearch.search).toHaveBeenCalled();
      expect(fallbackSearch.search).not.toHaveBeenCalled();
      expect(cache.setJson).toHaveBeenCalled();
    });

    it('falls back to Postgres when Meilisearch throws, instead of failing the request', async () => {
      catalogSearch.search.mockRejectedValue(new Error('connection refused'));
      fallbackSearch.search.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      });

      const result = await service.searchCatalog(query, 'corr-1');

      expect(fallbackSearch.search).toHaveBeenCalledWith(query);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('updateOwned / deleteOwned cache invalidation', () => {
    it('invalidates the product cache and search cache after an update', async () => {
      productsRepository.findOne.mockResolvedValue({
        id: 'p1',
        sellerProfileId: 'seller-a',
        name: 'Old',
      });
      await service.updateOwned('p1', 'seller-a', { name: 'New' }, 'corr-1');
      expect(cache.invalidateProduct).toHaveBeenCalledWith('p1');
      expect(cache.invalidateSearch).toHaveBeenCalled();
    });

    it('invalidates the product cache and search cache after a delete', async () => {
      productsRepository.findOne.mockResolvedValue({
        id: 'p1',
        sellerProfileId: 'seller-a',
      });
      await service.deleteOwned('p1', 'seller-a', 'corr-1');
      expect(cache.invalidateProduct).toHaveBeenCalledWith('p1');
      expect(cache.invalidateSearch).toHaveBeenCalled();
    });
  });
});
