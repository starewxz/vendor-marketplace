import {
  Global,
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfig } from '../common/config/configuration';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Closes the shared ioredis client on `app.close()` / shutdown. Without
 * this, the open TCP connection keeps the Node process alive indefinitely
 * after tests or a graceful shutdown — harmless in the long-running server,
 * but it silently hangs `jest --runInBand` for e2e tests.
 */
@Injectable()
class RedisShutdownHook implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

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
    RedisShutdownHook,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
