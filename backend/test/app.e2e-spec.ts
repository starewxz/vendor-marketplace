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

  it('/api/health (GET) reports service status', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect((res) => {
        expect([200, 503]).toContain(res.status);
        expect(res.body).toHaveProperty('status');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
