import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';

/**
 * The transaction inside CheckoutService touches Cart/CartItem/Product/
 * SellerOrder/SellerOrderItem/LedgerEntry/CheckoutIdempotencyKey via the
 * shared EntityManager directly (`manager.find/save/insert`), not via
 * injected repositories — those entities are already registered on the
 * app's single DataSource by their owning modules, so only Order needs
 * `forFeature` here for the one `@InjectRepository` this module actually
 * uses.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Order]), OutboxModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
