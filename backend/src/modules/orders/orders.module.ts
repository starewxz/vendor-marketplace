import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { SellerOrder } from './entities/seller-order.entity';
import { SellerOrderItem } from './entities/seller-order-item.entity';
import { CheckoutIdempotencyKey } from './entities/checkout-idempotency-key.entity';
import { SellersModule } from '../sellers/sellers.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { SellerOrdersService } from './seller-orders.service';
import { SellerOrdersController } from './seller-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminOrdersController } from './admin-orders.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      SellerOrder,
      SellerOrderItem,
      CheckoutIdempotencyKey,
    ]),
    SellersModule,
  ],
  controllers: [
    OrdersController,
    SellerOrdersController,
    AdminOrdersController,
  ],
  providers: [OrdersService, SellerOrdersService, AdminOrdersService],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
