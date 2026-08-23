import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ProcessedEvent } from '../outbox/entities/processed-event.entity';
import { SearchSyncProcessor } from './search-sync.processor';
import { ProductsModule } from '../products/products.module';
import { QUEUE_NAMES } from '../../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProcessedEvent]),
    BullModule.registerQueue({ name: QUEUE_NAMES.SEARCH_SYNC }),
    ProductsModule,
  ],
  providers: [SearchSyncProcessor],
})
export class SearchSyncModule {}
