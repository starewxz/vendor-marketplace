import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { ProcessedEvent } from '../outbox/entities/processed-event.entity';
import { Order } from '../orders/entities/order.entity';
import { SellerOrder } from '../orders/entities/seller-order.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { Auction } from '../bidding/entities/auction.entity';
import { Product } from '../products/entities/product.entity';
import { SellerApplication } from '../sellers/entities/seller-application.entity';
import { SellerProfile } from '../sellers/entities/seller-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcessedEvent,
      Order,
      SellerOrder,
      Dispute,
      Auction,
      Product,
      SellerApplication,
      SellerProfile,
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  providers: [NotificationsService, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
