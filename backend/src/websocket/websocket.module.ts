import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AppGateway } from './app.gateway';
import { AuthModule } from '../modules/auth/auth.module';
import { SellersModule } from '../modules/sellers/sellers.module';
import { UsersModule } from '../modules/users/users.module';
import { Product } from '../modules/products/entities/product.entity';
import { Auction } from '../modules/bidding/entities/auction.entity';
import { Bid } from '../modules/bidding/entities/bid.entity';
import { Order } from '../modules/orders/entities/order.entity';
import { SellerOrder } from '../modules/orders/entities/seller-order.entity';
import { ProcessedEvent } from '../modules/outbox/entities/processed-event.entity';
import { Dispute } from '../modules/disputes/entities/dispute.entity';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { RealtimeService } from './realtime.service';
import { RealtimeSubscriptionService } from './realtime-subscription.service';
import { SocketAuthService } from './socket-auth.service';
import { RealtimeProcessor } from './realtime.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Auction,
      Bid,
      Order,
      SellerOrder,
      ProcessedEvent,
      Dispute,
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.REALTIME }),
    AuthModule,
    UsersModule,
    SellersModule,
  ],
  providers: [
    AppGateway,
    RealtimeService,
    RealtimeSubscriptionService,
    SocketAuthService,
    RealtimeProcessor,
  ],
  exports: [RealtimeService],
})
export class WebsocketModule {}
