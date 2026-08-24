import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CatalogCacheService } from '../../cache/catalog-cache.service';
import { isUniqueViolation } from '../../common/utils/slug';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { SellerOrderItem } from '../orders/entities/seller-order-item.entity';
import { SellerOrderStatus } from '../orders/entities/seller-order-status.enum';
import { OutboxService } from '../outbox/outbox.service';
import { Product } from '../products/entities/product.entity';
import { Refund } from '../refunds/entities/refund.entity';
import { RefundStatus } from '../refunds/entities/refund-status.enum';
import {
  CreateReviewDto,
  ReviewListQueryDto,
  ReviewView,
  UpdateReviewDto,
} from './dto/review.dto';
import { Review } from './entities/review.entity';
import {
  isReviewEligible,
  storedRatingAggregate,
} from './domain/review-policy';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    private readonly outbox: OutboxService,
    private readonly cache: CatalogCacheService,
    private readonly metrics: MetricsRegistryService,
  ) {}

  async list(
    productId: string,
    query: ReviewListQueryDto,
  ): Promise<{
    data: ReviewView[];
    meta: { page: number; pageSize: number; total: number };
  }> {
    const order =
      query.sort === 'oldest'
        ? { createdAt: 'ASC' as const }
        : query.sort === 'highest'
          ? { rating: 'DESC' as const, createdAt: 'DESC' as const }
          : query.sort === 'lowest'
            ? { rating: 'ASC' as const, createdAt: 'DESC' as const }
            : { createdAt: 'DESC' as const };
    const [rows, total] = await this.reviews.findAndCount({
      where: { productId, ...(query.rating ? { rating: query.rating } : {}) },
      relations: { customer: true },
      order,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      data: rows.map((row) => this.toView(row)),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async eligibility(
    customerId: string,
    productId: string,
  ): Promise<{
    eligible: boolean;
    sellerOrderItemId: string | null;
    existingReview: ReviewView | null;
    reason?: string;
  }> {
    const existing = await this.reviews.findOne({
      where: { productId, customerId },
      relations: { customer: true },
    });
    if (existing)
      return {
        eligible: false,
        sellerOrderItemId: existing.sellerOrderItemId,
        existingReview: this.toView(existing, customerId),
        reason: 'ALREADY_REVIEWED',
      };
    const item = await this.findEligibleItem(
      this.reviews.manager,
      customerId,
      productId,
    );
    return item
      ? { eligible: true, sellerOrderItemId: item.id, existingReview: null }
      : {
          eligible: false,
          sellerOrderItemId: null,
          existingReview: null,
          reason: 'NO_ELIGIBLE_PURCHASE',
        };
  }

  async create(
    customerId: string,
    productId: string,
    dto: CreateReviewDto,
    correlationId: string,
  ): Promise<ReviewView> {
    try {
      const review = await this.reviews.manager.transaction(async (manager) => {
        await this.lockProduct(manager, productId);
        const item = await this.findEligibleItem(
          manager,
          customerId,
          productId,
          dto.sellerOrderItemId,
        );
        if (!item)
          throw new ForbiddenException(
            'A completed, non-fully-refunded purchase is required to review this product',
          );
        const created = await manager.save(
          manager.create(Review, {
            productId,
            customerId,
            sellerOrderItemId: item.id,
            rating: dto.rating,
            comment: dto.comment?.trim() ?? null,
          }),
        );
        await this.recalculateRating(manager, productId, correlationId);
        return created;
      });
      await this.invalidate(productId);
      this.metrics.increment('reviews_created_total');
      this.logger.log(
        `[${correlationId}] review created reviewId=${review.id} productId=${productId} customerId=${customerId}`,
      );
      const loaded = await this.reviews.findOneOrFail({
        where: { id: review.id },
        relations: { customer: true },
      });
      return this.toView(loaded, customerId);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('This purchase has already been reviewed');
      throw error;
    }
  }

  async update(
    customerId: string,
    reviewId: string,
    dto: UpdateReviewDto,
    correlationId: string,
  ): Promise<ReviewView> {
    const ownership = await this.reviews.findOne({
      where: { id: reviewId, customerId },
    });
    if (!ownership) throw new NotFoundException('Review not found');
    const review = await this.reviews.manager.transaction(async (manager) => {
      await this.lockProduct(manager, ownership.productId);
      const existing = await manager.findOne(Review, {
        where: { id: reviewId, customerId },
        relations: { customer: true },
      });
      if (!existing) throw new NotFoundException('Review not found');
      if (dto.rating !== undefined) existing.rating = dto.rating;
      if (dto.comment !== undefined) existing.comment = dto.comment.trim();
      const saved = await manager.save(existing);
      await this.recalculateRating(manager, existing.productId, correlationId);
      return saved;
    });
    await this.invalidate(review.productId);
    this.logger.log(
      `[${correlationId}] review updated reviewId=${review.id} customerId=${customerId}`,
    );
    return this.toView(review, customerId);
  }

  async remove(
    customerId: string,
    reviewId: string,
    correlationId: string,
  ): Promise<void> {
    const ownership = await this.reviews.findOne({
      where: { id: reviewId, customerId },
    });
    if (!ownership) throw new NotFoundException('Review not found');
    const productId = await this.reviews.manager.transaction(
      async (manager) => {
        await this.lockProduct(manager, ownership.productId);
        const review = await manager.findOne(Review, {
          where: { id: reviewId, customerId },
        });
        if (!review) throw new NotFoundException('Review not found');
        await manager.remove(review);
        await this.recalculateRating(manager, review.productId, correlationId);
        return review.productId;
      },
    );
    await this.invalidate(productId);
    this.logger.log(
      `[${correlationId}] review deleted reviewId=${reviewId} customerId=${customerId}`,
    );
  }

  private async findEligibleItem(
    manager: EntityManager,
    customerId: string,
    productId: string,
    itemId?: string,
  ): Promise<SellerOrderItem | null> {
    const qb = manager
      .createQueryBuilder(SellerOrderItem, 'item')
      .innerJoinAndSelect('item.sellerOrder', 'sellerOrder')
      .innerJoin('sellerOrder.order', 'order')
      .where('item.productId = :productId', { productId })
      .andWhere('order.buyerId = :customerId', { customerId })
      .andWhere('sellerOrder.status = :status', {
        status: SellerOrderStatus.DELIVERED,
      })
      .orderBy('item.createdAt', 'DESC');
    if (itemId) qb.andWhere('item.id = :itemId', { itemId });
    for (const item of await qb.getMany()) {
      const result = await manager
        .createQueryBuilder(Refund, 'refund')
        .select('COALESCE(SUM(refund.quantity), 0)', 'quantity')
        .where('refund.sellerOrderItemId = :itemId', { itemId: item.id })
        .andWhere('refund.status = :status', { status: RefundStatus.COMPLETED })
        .getRawOne<{ quantity: string }>();
      if (
        isReviewEligible(
          item.sellerOrder.status,
          item.quantity,
          Number(result?.quantity ?? 0),
        )
      )
        return item;
    }
    return null;
  }

  private async lockProduct(
    manager: EntityManager,
    productId: string,
  ): Promise<void> {
    if (
      !(await manager.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
      }))
    )
      throw new NotFoundException('Product not found');
  }

  private async recalculateRating(
    manager: EntityManager,
    productId: string,
    correlationId: string,
  ): Promise<void> {
    const a = await manager
      .createQueryBuilder(Review, 'review')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(AVG(review.rating), 0)', 'average')
      .where('review.productId = :productId', { productId })
      .getRawOne<{ count: string; average: string }>();
    const count = Number(a?.count ?? 0);
    await manager.update(
      Product,
      productId,
      storedRatingAggregate(count, Number(a?.average ?? 0)),
    );
    await this.outbox.record(manager, {
      eventType: 'PRODUCT_UPDATED',
      aggregateType: 'Product',
      aggregateId: productId,
      payload: { productId, reason: 'RATING_CHANGED' },
      correlationId,
    });
  }

  private async invalidate(productId: string): Promise<void> {
    await this.cache.invalidateProduct(productId);
    await this.cache.invalidateSearch();
  }
  private toView(review: Review, currentCustomerId?: string): ReviewView {
    const initial = review.customer?.lastName?.trim().charAt(0);
    return {
      id: review.id,
      productId: review.productId,
      sellerOrderItemId: review.sellerOrderItemId,
      rating: review.rating,
      comment: review.comment,
      customerDisplayName: `${review.customer?.firstName ?? 'Customer'}${initial ? ` ${initial}.` : ''}`,
      isMine: review.customerId === currentCustomerId,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}
