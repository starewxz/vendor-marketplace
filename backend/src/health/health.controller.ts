import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { Meilisearch } from 'meilisearch';
import { REDIS_CLIENT } from '../redis/redis.module';
import { AppConfig } from '../common/config/configuration';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly meiliClient: Meilisearch;

  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.meiliClient = new Meilisearch({
      host: configService.get('meilisearch.url', { infer: true }),
      apiKey: configService.get('meilisearch.apiKey', { infer: true }),
    });
  }

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('postgres'),
      () => this.pingRedis(),
      () => this.pingMeilisearch(),
    ]);
  }

  /**
   * Process-liveness only — no Postgres/Redis/Meilisearch calls. Deliberately
   * separate from `check()` above: a Kubernetes livenessProbe must never
   * depend on downstream services, or a transient Meilisearch/Redis blip
   * would make the kubelet kill and restart an otherwise-healthy Nest
   * process. Use this for livenessProbe and `check()` (GET /health) for
   * readinessProbe.
   */
  @Public()
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  private async pingRedis(): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return { redis: { status: 'up' } };
    } catch (error) {
      return {
        redis: { status: 'down', message: (error as Error).message },
      };
    }
  }

  private async pingMeilisearch(): Promise<HealthIndicatorResult> {
    try {
      await this.meiliClient.health();
      return { meilisearch: { status: 'up' } };
    } catch (error) {
      return {
        meilisearch: { status: 'down', message: (error as Error).message },
      };
    }
  }
}
