import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { SellerOrder } from './entities/seller-order.entity';
import { SellerOrderItem } from './entities/seller-order-item.entity';
import { CheckoutIdempotencyKey } from './entities/checkout-idempotency-key.entity';
import { SellersModule } from '../sellers/sellers.module';
import { OutboxModule } from '../outbox/outbox.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { SellerOrdersService } from './seller-orders.service';
import { SellerOrdersController } from './seller-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminSellerOrdersService } from './admin-seller-orders.service';
import { AdminSellerOrdersController } from './admin-seller-orders.controller';
import { SellerOrderLifecycleService } from './seller-order-lifecycle.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      SellerOrder,
      SellerOrderItem,
      CheckoutIdempotencyKey,
    ]),
    SellersModule,
    OutboxModule,
  ],
  controllers: [
    OrdersController,
    SellerOrdersController,
    AdminOrdersController,
    AdminSellerOrdersController,
  ],
  providers: [
    OrdersService,
    SellerOrdersService,
    AdminOrdersService,
    AdminSellerOrdersService,
    SellerOrderLifecycleService,
  ],
  exports: [OrdersService, SellerOrderLifecycleService, TypeOrmModule],
})
export class OrdersModule {}
