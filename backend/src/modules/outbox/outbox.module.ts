import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { OutboxService } from './outbox.service';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent, ProcessedEvent])],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
