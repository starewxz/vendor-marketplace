import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ProcessedEvent } from '../outbox/entities/processed-event.entity';
import { SellerOrder } from '../orders/entities/seller-order.entity';
import { SellerOrderProcessingProcessor } from './seller-order-processing.processor';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProcessedEvent, SellerOrder]),
    BullModule.registerQueue({ name: QUEUE_NAMES.SELLER_ORDER_PROCESSING }),
  ],
  providers: [SellerOrderProcessingProcessor],
})
export class SellerOrderProcessingModule {}
