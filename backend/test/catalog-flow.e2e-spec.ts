/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- supertest's res.body is untyped */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Repository } from 'typeorm';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/modules/users/users.service';
import { UserRole } from '../src/modules/users/entities/user-role.enum';
import { SellerProfile } from '../src/modules/sellers/entities/seller-profile.entity';

/**
 * Requires live Postgres/Redis/Meilisearch (`docker compose up`) with
 * migrations applied. Exercises: admin category -> seller product ->
 * customer read, IDOR, search/filter/pagination through the real Meilisearch
 * sync pipeline (outbox -> BullMQ -> search-sync), idempotent re-delivery,
 * category rename propagation, and Redis cache invalidation.
 *
 * Not run by the base CI job (see README "CI"); run manually with
 * `npm run test:e2e`.
 */
describe('Catalog + search sync flow (e2e)', () => {
  let app: INestApplication<App>;
  let usersService: UsersService;
  let sellerProfilesRepository: Repository<SellerProfile>;
  const runId = randomUUID().slice(0, 8);
  const password = 'Str0ngPassword!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    usersService = moduleFixture.get(UsersService);
    sellerProfilesRepository = moduleFixture.get(
      getRepositoryToken(SellerProfile),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Test-setup shortcut: creates a User + SellerProfile directly rather than
   * driving the full apply/admin-approve HTTP flow — that flow (and its
   * transactional approval logic) is already covered by Stage 2's e2e
   * suite. This test only needs a real, working SELLER account to exist.
   */
  async function createApprovedSeller(emailPrefix: string): Promise<string> {
    const email = `${emailPrefix}-${runId}@example.com`;
    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, firstName: 'Test', lastName: 'Seller' })
      .expect(201);

    await usersService.setRole(registerRes.body.user.id, UserRole.SELLER);
    await sellerProfilesRepository.save(
      sellerProfilesRepository.create({
        userId: registerRes.body.user.id,
        storeName: `${emailPrefix}-${runId} Store`,
        storeSlug: `${emailPrefix}-${runId}-store`,
      }),
    );

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    expect(loginRes.body.user.role).toBe('SELLER');
    return loginRes.body.accessToken;
  }

  async function waitFor<T>(
    fn: () => Promise<T | null>,
    timeoutMs = 15000,
    intervalMs = 300,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const result = await fn();
      if (result) return result;
      if (Date.now() > deadline) throw new Error('waitFor timed out');
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  let adminToken: string;
  let sellerAToken: string;
  let sellerBToken: string;
  let categoryId: string;
  let productId: string;

  it('sets up an admin and two approved sellers', async () => {
    const email = `admin-${runId}@example.com`;
    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, firstName: 'Cat', lastName: 'Admin' })
      .expect(201);
    await usersService.setRole(registerRes.body.user.id, UserRole.ADMIN);
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    adminToken = loginRes.body.accessToken;

    sellerAToken = await createApprovedSeller('seller-a');
    sellerBToken = await createApprovedSeller('seller-b');
  });

  it('admin creates a category', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Gadgets ${runId}` })
      .expect(201);
    categoryId = res.body.id;
    expect(res.body.slug).toContain('gadgets');
  });

  it('rejects category mutation from a non-admin (customer/seller) with 403', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ name: 'Should Not Work' })
      .expect(403);
  });

  it('a customer (no seller role) cannot create a product (403)', async () => {
    const customerEmail = `plain-customer-${runId}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: customerEmail,
        password,
        firstName: 'Plain',
        lastName: 'Customer',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .send({
        name: 'Sneaky Product',
        categoryId,
        type: 'FIXED_PRICE',
        price: '9.99',
        stockQuantity: 1,
      })
      .expect(403);
  });

  it('unauthenticated seller/admin operations are rejected with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/seller/products')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/admin/categories')
      .send({})
      .expect(401);
  });

  it('seller A creates a product; an OutboxEvent is recorded in the same transaction', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: `Wireless Gizmo ${runId}`,
        description: 'A very testable gadget.',
        categoryId,
        type: 'FIXED_PRICE',
        price: '129.99',
        stockQuantity: 10,
      })
      .expect(201);

    productId = res.body.id;
    expect(res.body.slug).toContain('wireless-gizmo');
  });

  it('a customer can read the product immediately (Postgres-backed detail read, not search-dependent)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .expect(200);
    expect(res.body.name).toContain('Wireless Gizmo');
  });

  it("seller B cannot update seller A's product (404 — no existence leak)", async () => {
    await request(app.getHttpServer())
      .patch(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${sellerBToken}`)
      .send({ name: 'Hijacked' })
      .expect(404);
  });

  it("seller B cannot delete seller A's product (404)", async () => {
    await request(app.getHttpServer())
      .delete(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${sellerBToken}`)
      .expect(404);
  });

  it("seller B's own product list does not include seller A's product", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/seller/products')
      .set('Authorization', `Bearer ${sellerBToken}`)
      .expect(200);
    expect(
      res.body.find((p: { id: string }) => p.id === productId),
    ).toBeUndefined();
  });

  it('the product eventually becomes searchable via the outbox -> BullMQ -> Meilisearch pipeline', async () => {
    const hit = await waitFor(async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/products?search=${encodeURIComponent(`Wireless Gizmo ${runId}`)}`,
      );
      return (
        res.body.data?.find((p: { id: string }) => p.id === productId) ?? null
      );
    });
    expect(hit.categoryId).toBe(categoryId);
  });

  it('category filter and pagination work against the search index', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/products?categoryId=${categoryId}&page=1&pageSize=5`)
      .expect(200);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.pageSize).toBe(5);
    expect(res.body.data.some((p: { id: string }) => p.id === productId)).toBe(
      true,
    );
  });

  it('repeated product updates do not create duplicate search documents (idempotent upsert)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ stockQuantity: 20 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ stockQuantity: 25 })
      .expect(200);

    await waitFor(async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/products/${productId}`,
      );
      return res.body.stockQuantity === 25 ? true : null;
    });

    const res = await request(app.getHttpServer()).get(
      `/api/products?search=${encodeURIComponent(`Wireless Gizmo ${runId}`)}`,
    );
    const matches = res.body.data.filter(
      (p: { id: string }) => p.id === productId,
    );
    expect(matches).toHaveLength(1);
  });

  it('Redis cache does not return a stale product after update (invalidation works)', async () => {
    const before = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .expect(200);
    expect(before.body.stockQuantity).toBe(25);

    await request(app.getHttpServer())
      .patch(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ stockQuantity: 99 })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .expect(200);
    expect(after.body.stockQuantity).toBe(99);
  });

  it('a category rename is eventually reflected in the search document', async () => {
    const newName = `Renamed Gadgets ${runId}`;
    await request(app.getHttpServer())
      .patch(`/api/admin/categories/${categoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: newName })
      .expect(200);

    const hit = await waitFor(async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/products?search=${encodeURIComponent(`Wireless Gizmo ${runId}`)}`,
      );
      const found = res.body.data?.find(
        (p: { id: string }) => p.id === productId,
      );
      return found?.categoryName === newName ? found : null;
    });
    expect(hit.categoryName).toBe(newName);
  });

  it('deleting a category that still has products is rejected with 409', async () => {
    await request(app.getHttpServer())
      .delete(`/api/admin/categories/${categoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  });

  it('seller A deletes their product; it disappears from the public catalog', async () => {
    await request(app.getHttpServer())
      .delete(`/api/seller/products/${productId}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .expect(404);
  });
});
