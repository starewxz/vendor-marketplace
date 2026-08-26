/* eslint-disable @typescript-eslint/no-unsafe-member-access -- supertest's res.body is untyped */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Requires live Postgres/Redis/Meilisearch (e.g. `docker compose up`) since
 * AppModule wires real connections for all three. Not run by the base CI
 * job yet — see README "CI" section.
 */
describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/health (GET) reports 200 with per-component detail when every dependency is up', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.details.postgres.status).toBe('up');
        expect(res.body.details.redis.status).toBe('up');
        expect(res.body.details.meilisearch.status).toBe('up');
      });
  });

  it('/api/health/live (GET) reports process liveness without checking dependencies', () => {
    return request(app.getHttpServer())
      .get('/api/health/live')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ status: 'ok' });
      });
  });

  afterEach(async () => {
    if (app) await app.close();
  });
});

/**
 * Reproduces the real degraded-dependency path end to end: a genuinely
 * unreachable Meilisearch (not a mock) makes Terminus throw a real
 * ServiceUnavailableException carrying the full { status, info, error,
 * details } payload, which must survive AllExceptionsFilter unchanged (see
 * all-exceptions.filter.ts / all-exceptions.filter.spec.ts for the unit-level
 * proof of the filter logic itself). Postgres/Redis are left pointed at the
 * real services so only one component is actually down.
 */
describe('AppModule (e2e) — degraded /api/health', () => {
  let degradedApp: INestApplication<App>;

  beforeAll(async () => {
    const originalMeilisearchUrl = process.env.MEILISEARCH_URL;
    process.env.MEILISEARCH_URL = 'http://127.0.0.1:1';
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      degradedApp = moduleFixture.createNestApplication();
      degradedApp.setGlobalPrefix('api');
      await degradedApp.init();
    } finally {
      process.env.MEILISEARCH_URL = originalMeilisearchUrl;
    }
  });

  afterAll(async () => {
    if (degradedApp) await degradedApp.close();
  });

  it('/api/health (GET) returns 503 with per-component detail preserved through the global exception filter', async () => {
    const res = await request(degradedApp.getHttpServer()).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.details.postgres.status).toBe('up');
    expect(res.body.details.redis.status).toBe('up');
    expect(res.body.details.meilisearch.status).toBe('down');
    expect(res.body.error.meilisearch.status).toBe('down');
    // Must NOT have collapsed into the generic AllExceptionsFilter shape.
    expect(res.body).not.toHaveProperty('statusCode');
    expect(res.body).not.toHaveProperty('correlationId');
  }, 20000);
});
