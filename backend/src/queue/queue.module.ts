import { Module } from '@nestjs/common';
import { BullModule, RegisterQueueOptions } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../common/config/configuration';
import { QUEUE_NAMES } from './queue.constants';

const queueRegistrations: RegisterQueueOptions[] = Object.values(
  QUEUE_NAMES,
).map((name) => ({
  name,
}));

/**
 * Registers the Redis connection BullMQ uses and declares every queue name
 * up front. No processors/business jobs are wired here yet — later stages
 * add `@Processor` classes per queue inside their owning module and import
 * `BullModule.registerQueue({ name: QUEUE_NAMES.X })` there.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const redisUrl = configService.get('redis.url', { infer: true });
        return {
          connection: {
            url: redisUrl,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    BullModule.registerQueue(...queueRegistrations),
  ],
  exports: [BullModule],
})
export class QueueModule {}
