import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../common/config/configuration';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Single shared ioredis client for direct cache/lock use cases. BullMQ
 * manages its own connections separately (see QueueModule) since it has
 * different connection-option requirements (maxRetriesPerRequest: null).
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const url = configService.get('redis.url', { infer: true });
        return new Redis(url, { lazyConnect: false });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
