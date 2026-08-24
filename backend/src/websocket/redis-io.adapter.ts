import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { INestApplicationContext } from '@nestjs/common';
import type { Server, ServerOptions } from 'socket.io';
import { MetricsRegistryService } from '../modules/metrics/metrics-registry.service';

async function connectWithTimeout(
  clients: [Redis, Redis],
  timeoutMs: number,
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all(clients.map((client) => client.connect())),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Redis adapter connection timed out')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Installs the Redis adapter before Nest creates the Socket.IO server. This
 * ordering matters: replacing an in-memory adapter after clients have joined
 * can discard their room memberships and break cross-replica delivery.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private installed = false;

  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string,
    private readonly metrics: MetricsRegistryService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const pub = new Redis(this.redisUrl, {
      lazyConnect: true,
      connectTimeout: 2_000,
    });
    const sub = pub.duplicate({ lazyConnect: true });
    pub.on('error', (error) => this.logRedisError('publisher', error));
    sub.on('error', (error) => this.logRedisError('subscriber', error));
    try {
      await connectWithTimeout([pub, sub], 2_500);
      this.pubClient = pub;
      this.subClient = sub;
      this.adapterConstructor = createAdapter(pub, sub);
      this.logger.log('Socket.IO Redis adapter ready');
    } catch (error) {
      pub.disconnect();
      sub.disconnect();
      this.metrics.increment('websocket_errors_total');
      this.logger.warn(
        `Socket.IO Redis adapter unavailable; continuing single-instance: ${(error as Error).message}`,
      );
    }
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      this.installed = true;
    }
    return server;
  }

  isRedisAdapterInstalled(): boolean {
    return this.installed;
  }

  async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.all(
      [this.pubClient, this.subClient]
        .filter((client): client is Redis => client !== null)
        .map(async (client) => {
          if (client.status === 'end') return;
          await client.quit().catch(() => client.disconnect());
        }),
    );
  }

  private logRedisError(role: string, error: Error): void {
    this.metrics.increment('websocket_errors_total');
    this.logger.warn(`Socket.IO Redis ${role} error: ${error.message}`);
  }
}
