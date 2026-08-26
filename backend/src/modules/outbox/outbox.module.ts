import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { OutboxEvent } from './entities/outbox-event.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { DeadLetterEvent } from './entities/dead-letter-event.entity';
import { OutboxService } from './outbox.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { DeadLetterService } from './dead-letter.service';
import { DeadLetterListenerService } from './dead-letter-listener.service';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEvent, ProcessedEvent, DeadLetterEvent]),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.SEARCH_SYNC },
      { name: QUEUE_NAMES.SELLER_ORDER_PROCESSING },
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.REALTIME },
      { name: QUEUE_NAMES.AUCTION_FINALIZATION },
    ),
  ],
  providers: [
    OutboxService,
    OutboxPublisherService,
    DeadLetterService,
    DeadLetterListenerService,
  ],
  exports: [OutboxService, DeadLetterService],
})
export class OutboxModule {}
