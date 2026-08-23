/* eslint-disable @typescript-eslint/no-unsafe-return -- jest.fn() mock typing */
import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { OutboxService } from '../outbox/outbox.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoriesRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    exists: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let productsRepository: { count: jest.Mock };
  let cache: {
    getJson: jest.Mock;
    setJson: jest.Mock;
    categoriesCacheKey: jest.Mock;
    categoriesCacheTtl: jest.Mock;
    invalidateCategories: jest.Mock;
    invalidateSearch: jest.Mock;
  };
  let outboxService: { record: jest.Mock };
  let fakeManager: { save: jest.Mock; merge: jest.Mock; remove: jest.Mock };

  beforeEach(async () => {
    fakeManager = {
      save: jest.fn((x) => x),
      merge: jest.fn((_e, target, source) => Object.assign(target, source)),
      remove: jest.fn((x) => x),
    };
    categoriesRepository = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((x) => x),
      exists: jest.fn().mockResolvedValue(false),
      manager: {
        transaction: jest.fn((cb: (m: unknown) => unknown) => cb(fakeManager)),
      },
    };
    productsRepository = { count: jest.fn().mockResolvedValue(0) };
    cache = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn(),
      categoriesCacheKey: jest.fn().mockReturnValue('catalog:categories'),
      categoriesCacheTtl: jest.fn().mockReturnValue(300),
      invalidateCategories: jest.fn(),
      invalidateSearch: jest.fn(),
    };
    outboxService = { record: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: categoriesRepository,
        },
        { provide: getRepositoryToken(Product), useValue: productsRepository },
        { provide: CatalogCacheService, useValue: cache },
        { provide: OutboxService, useValue: outboxService },
      ],
    }).compile();

    service = moduleRef.get(CategoriesService);
  });

  describe('create', () => {
    it('rejects a duplicate category name with 409', async () => {
      categoriesRepository.findOne.mockResolvedValue({
        id: 'existing',
        name: 'Electronics',
      });
      await expect(
        service.create({ name: 'Electronics' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a category and invalidates the categories + search cache', async () => {
      categoriesRepository.findOne.mockResolvedValue(null);
      const category = await service.create({ name: 'Electronics' });
      expect(category.slug).toBe('electronics');
      expect(cache.invalidateCategories).toHaveBeenCalled();
      expect(cache.invalidateSearch).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('rejects deleting a category that still has products (409, not silently orphaning them)', async () => {
      categoriesRepository.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Electronics',
      });
      productsRepository.count.mockResolvedValue(3);

      await expect(service.delete('cat-1', 'corr-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(fakeManager.remove).not.toHaveBeenCalled();
    });

    it('deletes a category with no products and records a CATEGORY_DELETED event', async () => {
      categoriesRepository.findOne.mockResolvedValue({
        id: 'cat-1',
        name: 'Empty',
      });
      productsRepository.count.mockResolvedValue(0);

      await service.delete('cat-1', 'corr-1');

      expect(fakeManager.remove).toHaveBeenCalled();
      expect(outboxService.record).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({ eventType: 'CATEGORY_DELETED' }),
      );
    });
  });
});
