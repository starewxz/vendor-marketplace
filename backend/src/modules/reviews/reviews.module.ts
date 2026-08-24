import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { Product } from '../products/entities/product.entity';
import { SellerOrderItem } from '../orders/entities/seller-order-item.entity';
import { Refund } from '../refunds/entities/refund.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { CacheModule } from '../../cache/cache.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Product, SellerOrderItem, Refund]),
    OutboxModule,
    CacheModule,
    MetricsModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
