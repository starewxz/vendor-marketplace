import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../common/config/configuration';
import { validateEnv } from '../common/config/env.validation';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { OutboxModule } from '../modules/outbox/outbox.module';
import { MetricsModule } from '../modules/metrics/metrics.module';

/**
 * Shared by dlq-list.ts / dlq-replay.ts. Needs BullMQ (unlike the narrower
 * seed-admin/search-reindex scripts) since replay re-enqueues a job — reuses
 * OutboxModule as-is rather than re-declaring its providers/queues here.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    DatabaseModule,
    QueueModule,
    MetricsModule,
    OutboxModule,
  ],
})
export class DlqModule {}
