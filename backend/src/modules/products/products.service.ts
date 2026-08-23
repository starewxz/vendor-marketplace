import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';

/**
 * Deliberately has no dependency on Meilisearch/BullMQ. Catalog writes here
 * emit an OutboxEvent (added once outbox writers exist in Stage 3+); a
 * separate search-sync consumer reacts to it. This keeps ProductService
 * free of infrastructure concerns and avoids a dual write to Postgres and
 * the search index.
 */
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async findById(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  findPublished(): Promise<Product[]> {
    return this.productsRepository.find({ where: { isPublished: true } });
  }
}
