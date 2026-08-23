import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { generateUniqueSlug, isUniqueViolation } from '../../common/utils/slug';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { OutboxService } from '../outbox/outbox.service';

const MAX_SLUG_ATTEMPTS = 5;

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly cache: CatalogCacheService,
    private readonly outboxService: OutboxService,
  ) {}

  async findAll(): Promise<Category[]> {
    const cached = await this.cache.getJson<Category[]>(
      this.cache.categoriesCacheKey(),
    );
    if (cached) return cached;

    const categories = await this.categoriesRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
    await this.cache.setJson(
      this.cache.categoriesCacheKey(),
      categories,
      this.cache.categoriesCacheTtl(),
    );
    return categories;
  }

  async findById(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    await this.assertNameAvailable(dto.name);

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = await generateUniqueSlug(dto.name, async (candidate) =>
        this.categoriesRepository.exists({ where: { slug: candidate } }),
      );
      try {
        const category = this.categoriesRepository.create({
          name: dto.name,
          slug,
          parentId: dto.parentId ?? null,
          iconUrl: dto.iconUrl ?? null,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        });
        const saved = await this.categoriesRepository.save(category);
        await this.cache.invalidateCategories();
        await this.cache.invalidateSearch();
        this.logger.log(`category created categoryId=${saved.id}`);
        return saved;
      } catch (error) {
        if (isUniqueViolation(error)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    // Either the slug kept colliding across every retry, or (rarely) a
    // concurrent request took the same name between our pre-check and the
    // insert — either way, surface a clean 409 instead of the raw driver
    // error the exception filter would otherwise report as a 500.
    this.logger.warn(
      `category create exhausted slug retries: ${(lastError as Error)?.message}`,
    );
    throw new ConflictException(
      `Category "${dto.name}" could not be created — name or slug already in use`,
    );
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    correlationId: string,
  ): Promise<Category> {
    const category = await this.findById(id);
    if (dto.name && dto.name !== category.name) {
      await this.assertNameAvailable(dto.name, id);
    }

    const updated = await this.categoriesRepository.manager.transaction(
      async (manager) => {
        manager.merge(Category, category, {
          name: dto.name,
          parentId: dto.parentId,
          iconUrl: dto.iconUrl,
          sortOrder: dto.sortOrder,
          isActive: dto.isActive,
        });
        const saved = await manager.save(category);
        await this.outboxService.record(manager, {
          eventType: 'CATEGORY_UPDATED',
          aggregateType: 'Category',
          aggregateId: saved.id,
          payload: { categoryId: saved.id },
          correlationId,
        });
        return saved;
      },
    );

    await this.cache.invalidateCategories();
    await this.cache.invalidateSearch();
    this.logger.log(`[${correlationId}] category updated categoryId=${id}`);
    return updated;
  }

  /**
   * Products reference their category with `onDelete: RESTRICT` at the DB
   * level — that FK constraint is the actual backstop against orphaning
   * products; this pre-check just gives a clean 409 instead of a raw
   * Postgres constraint-violation error.
   */
  async delete(id: string, correlationId: string): Promise<void> {
    const category = await this.findById(id);
    const productCount = await this.productsRepository.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `Category "${category.name}" has ${productCount} product(s) and cannot be deleted. Reassign or remove them first.`,
      );
    }

    await this.categoriesRepository.manager.transaction(async (manager) => {
      await manager.remove(category);
      await this.outboxService.record(manager, {
        eventType: 'CATEGORY_DELETED',
        aggregateType: 'Category',
        aggregateId: id,
        payload: { categoryId: id },
        correlationId,
      });
    });

    await this.cache.invalidateCategories();
    await this.cache.invalidateSearch();
    this.logger.log(`[${correlationId}] category deleted categoryId=${id}`);
  }

  private async assertNameAvailable(
    name: string,
    excludingId?: string,
  ): Promise<void> {
    const existing = await this.categoriesRepository.findOne({
      where: { name },
    });
    if (existing && existing.id !== excludingId) {
      throw new ConflictException(`Category name "${name}" is already in use`);
    }
  }
}
