import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import configuration, { AppConfig } from './common/config/configuration';
import { validateEnv } from './common/config/env.validation';
import { LoggerModule } from './common/logger/logger.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { SearchModule } from './search/search.module';
import { WebsocketModule } from './websocket/websocket.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SellersModule } from './modules/sellers/sellers.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { SearchSyncModule } from './modules/search-sync/search-sync.module';
import { SellerOrderProcessingModule } from './modules/seller-order-processing/seller-order-processing.module';
import { CartModule } from './modules/cart/cart.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { OrdersModule } from './modules/orders/orders.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { BiddingModule } from './modules/bidding/bidding.module';
import { PaymentsLedgerModule } from './modules/payments-ledger/payments-ledger.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { CacheModule } from './cache/cache.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        throttlers: [
          {
            ttl:
              configService.get('rateLimit.ttlSeconds', { infer: true }) * 1000,
            limit: configService.get('rateLimit.maxRequests', { infer: true }),
          },
        ],
      }),
    }),
    DatabaseModule,
    RedisModule,
    CacheModule,
    QueueModule,
    SearchModule,
    WebsocketModule,

    // Infrastructure / cross-cutting
    HealthModule,
    MetricsModule,
    OutboxModule,

    // Domain modules
    AuthModule,
    UsersModule,
    SellersModule,
    CategoriesModule,
    ProductsModule,
    SearchSyncModule,
    SellerOrderProcessingModule,
    CartModule,
    CheckoutModule,
    OrdersModule,
    RefundsModule,
    BiddingModule,
    PaymentsLedgerModule,
    AnalyticsModule,
    NotificationsModule,
    ReviewsModule,
    DisputesModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: rate limit first, then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
