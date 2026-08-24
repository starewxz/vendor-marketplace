import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import {
  AdminAnalyticsController,
  SellerAnalyticsController,
} from './analytics.controller';
import { SellersModule } from '../sellers/sellers.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [SellersModule, MetricsModule],
  controllers: [SellerAnalyticsController, AdminAnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
