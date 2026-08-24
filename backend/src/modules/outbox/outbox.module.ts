import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { OutboxEvent } from './entities/outbox-event.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { OutboxService } from './outbox.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEvent, ProcessedEvent]),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.SEARCH_SYNC },
      { name: QUEUE_NAMES.SELLER_ORDER_PROCESSING },
      { name: QUEUE_NAMES.NOTIFICATIONS },
    ),
  ],
  providers: [OutboxService, OutboxPublisherService],
  exports: [OutboxService],
})
export class OutboxModule {}
