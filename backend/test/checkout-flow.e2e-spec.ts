/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- supertest's res.body is untyped */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Repository } from 'typeorm';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/modules/users/users.service';
import { UserRole } from '../src/modules/users/entities/user-role.enum';
import { SellerProfile } from '../src/modules/sellers/entities/seller-profile.entity';
import { LedgerEntry } from '../src/modules/payments-ledger/entities/ledger-entry.entity';
import { OutboxEvent } from '../src/modules/outbox/entities/outbox-event.entity';
import { ProcessedEvent } from '../src/modules/outbox/entities/processed-event.entity';

/**
 * Requires live Postgres/Redis/Meilisearch (`docker compose up`) with
 * migrations applied. Exercises Stage 4's multi-vendor cart -> checkout ->
 * order split -> atomic stock -> commission -> ledger -> idempotency ->
 * async SellerOrder processing flow end to end, plus IDOR across the
 * customer/seller/admin order APIs.
 *
 * Not run by the base `test` job; the `backend-e2e` CI job runs every
 * `*.e2e-spec.ts` file (including this one) against real services — see
 * README "CI".
 */
describe('Cart + checkout + multi-vendor order flow (e2e)', () => {
  let app: INestApplication<App>;
  let usersService: UsersService;
  let jwtService: JwtService;
  let sellerProfilesRepository: Repository<SellerProfile>;
  let ledgerEntriesRepository: Repository<LedgerEntry>;
  let outboxEventsRepository: Repository<OutboxEvent>;
  let processedEventsRepository: Repository<ProcessedEvent>;
  const runId = randomUUID().slice(0, 8);

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
    jwtService = moduleFixture.get(JwtService);
    sellerProfilesRepository = moduleFixture.get(
      getRepositoryToken(SellerProfile),
    );
    ledgerEntriesRepository = moduleFixture.get(
      getRepositoryToken(LedgerEntry),
    );
    outboxEventsRepository = moduleFixture.get(getRepositoryToken(OutboxEvent));
    processedEventsRepository = moduleFixture.get(
      getRepositoryToken(ProcessedEvent),
    );
  });

  afterAll(async () => {
    if (app) await app.close();
  });

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

  // Bulk test fixtures create dozens of accounts (esp. the concurrency
  // scenario's 10 buyers) well within one throttle window. The register/
  // login HTTP endpoints are deliberately rate-limited for brute-force
  // protection (see AuthController) — that's Stage 2 behavior this stage
  // must not weaken, so fixture setup mints JWTs directly the same way
  // AuthService does, instead of driving the throttled HTTP endpoints for
  // every test account. The real register->login path is already covered
  // by auth-flow.e2e-spec.ts.
  async function mintAccessToken(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<string> {
    return jwtService.signAsync({ sub: userId, email, role });
  }

  async function registerCustomer(prefix: string): Promise<{
    accessToken: string;
    userId: string;
  }> {
    const email = `${prefix}-${runId}@example.com`;
    const user = await usersService.create({
      email,
      passwordHash: null,
      firstName: 'Test',
      lastName: 'Customer',
      role: UserRole.CUSTOMER,
      isEmailVerified: true,
    });
    const accessToken = await mintAccessToken(user.id, user.email, user.role);
    return { accessToken, userId: user.id };
  }

  async function createApprovedSeller(
    prefix: string,
    commissionRatePercent?: string,
  ): Promise<{ accessToken: string; sellerProfileId: string }> {
    const email = `${prefix}-${runId}@example.com`;
    const user = await usersService.create({
      email,
      passwordHash: null,
      firstName: 'Test',
      lastName: 'Seller',
      role: UserRole.SELLER,
      isEmailVerified: true,
    });

    const profile = await sellerProfilesRepository.save(
      sellerProfilesRepository.create({
        userId: user.id,
        storeName: `${prefix}-${runId} Store`,
        storeSlug: `${prefix}-${runId}-store`,
        ...(commissionRatePercent ? { commissionRatePercent } : {}),
      }),
    );

    const accessToken = await mintAccessToken(user.id, user.email, user.role);
    return { accessToken, sellerProfileId: profile.id };
  }

  async function createProduct(
    sellerToken: string,
    categoryId: string,
    overrides: { name: string; price: string; stockQuantity: number },
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: overrides.name,
        categoryId,
        type: 'FIXED_PRICE',
        price: overrides.price,
        stockQuantity: overrides.stockQuantity,
      })
      .expect(201);
    return res.body.id;
  }

  let adminToken: string;
  let categoryId: string;

  it('sets up an admin and a shared category', async () => {
    const email = `checkout-admin-${runId}@example.com`;
    const admin = await usersService.create({
      email,
      passwordHash: null,
      firstName: 'Checkout',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      isEmailVerified: true,
    });
    adminToken = await mintAccessToken(admin.id, admin.email, admin.role);

    const categoryRes = await request(app.getHttpServer())
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Checkout Category ${runId}` })
      .expect(201);
    categoryId = categoryRes.body.id;
  });

  describe('(a) full multi-vendor checkout flow', () => {
    let buyerToken: string;
    let sellerAToken: string;
    let sellerBToken: string;
    let sellerAProfileId: string;
    let sellerBProfileId: string;
    let productAId: string;
    let productBId: string;
    let orderId: string;
    let sellerOrderAId: string;
    let sellerOrderBId: string;

    it('creates two sellers (different commission rates) and one product each', async () => {
      const buyer = await registerCustomer('flow-buyer');
      buyerToken = buyer.accessToken;

      const sellerA = await createApprovedSeller('flow-seller-a', '10.00');
      sellerAToken = sellerA.accessToken;
      sellerAProfileId = sellerA.sellerProfileId;

      const sellerB = await createApprovedSeller('flow-seller-b', '7.50');
      sellerBToken = sellerB.accessToken;
      sellerBProfileId = sellerB.sellerProfileId;

      productAId = await createProduct(sellerAToken, categoryId, {
        name: `Flow Gadget A ${runId}`,
        price: '49.99',
        stockQuantity: 10,
      });
      productBId = await createProduct(sellerBToken, categoryId, {
        name: `Flow Gadget B ${runId}`,
        price: '19.99',
        stockQuantity: 10,
      });
    });

    it('customer adds items from both sellers; GET /cart groups by seller', async () => {
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId: productAId, quantity: 2 })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId: productBId, quantity: 3 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(res.body.sellers).toHaveLength(2);
      expect(res.body.totalAmount).toBe('159.95');
    });

    it('checkout produces one Order, two SellerOrders, correct commission/net split, and clears the cart', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/cart/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('Idempotency-Key', `flow-checkout-${runId}`)
        .send({})
        .expect(201);

      orderId = res.body.orderId;
      expect(res.body.sellerOrders).toHaveLength(2);
      expect(res.body.totalAmount).toBe('159.95');
      expect(res.body.replayed).toBe(false);

      const sellerOrderA = res.body.sellerOrders.find(
        (so: { sellerProfileId: string }) =>
          so.sellerProfileId === sellerAProfileId,
      );
      const sellerOrderB = res.body.sellerOrders.find(
        (so: { sellerProfileId: string }) =>
          so.sellerProfileId === sellerBProfileId,
      );
      sellerOrderAId = sellerOrderA.id;
      sellerOrderBId = sellerOrderB.id;
      expect(sellerOrderA.subtotal).toBe('99.98');
      expect(sellerOrderA.commissionAmount).toBe('10.00');
      expect(sellerOrderA.sellerNetAmount).toBe('89.98');
      expect(sellerOrderB.subtotal).toBe('59.97');
      expect(sellerOrderB.commissionAmount).toBe('4.50');
      expect(sellerOrderB.sellerNetAmount).toBe('55.47');

      const cartRes = await request(app.getHttpServer())
        .get('/api/cart')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
      expect(cartRes.body.sellers).toHaveLength(0);
      expect(cartRes.body.totalAmount).toBe('0.00');
    });

    it('stock was atomically decremented for both products', async () => {
      const productA = await request(app.getHttpServer())
        .get(`/api/products/${productAId}`)
        .expect(200);
      const productB = await request(app.getHttpServer())
        .get(`/api/products/${productBId}`)
        .expect(200);
      expect(productA.body.stockQuantity).toBe(8);
      expect(productB.body.stockQuantity).toBe(7);
    });

    it('ledger has SALE_CREDIT + COMMISSION_DEBIT entries per seller', async () => {
      const entriesA = await ledgerEntriesRepository.find({
        where: { sellerProfileId: sellerAProfileId },
      });
      expect(entriesA.map((e) => e.type).sort()).toEqual(
        ['COMMISSION_DEBIT', 'SALE_CREDIT'].sort(),
      );
    });

    it('outbox recorded ORDER_CREATED, 2x SELLER_ORDER_CREATED, and STOCK_CHANGED for both products', async () => {
      const orderEvents = await outboxEventsRepository.find({
        where: { aggregateId: orderId, eventType: 'ORDER_CREATED' },
      });
      expect(orderEvents).toHaveLength(1);

      const sellerOrderEvents = await outboxEventsRepository.find({
        where: { eventType: 'SELLER_ORDER_CREATED' },
      });
      expect(
        sellerOrderEvents.filter(
          (e) => e.correlationId === orderEvents[0].correlationId,
        ),
      ).toHaveLength(2);

      const stockEventsA = await outboxEventsRepository.find({
        where: { aggregateId: productAId, eventType: 'STOCK_CHANGED' },
      });
      const stockEventsB = await outboxEventsRepository.find({
        where: { aggregateId: productBId, eventType: 'STOCK_CHANGED' },
      });
      expect(stockEventsA.length).toBeGreaterThanOrEqual(1);
      expect(stockEventsB.length).toBeGreaterThanOrEqual(1);
    });

    it('each SellerOrder is asynchronously processed to PROCESSING via the outbox -> BullMQ pipeline', async () => {
      const sellerOrderRes = await waitFor(async () => {
        const res = await request(app.getHttpServer())
          .get('/api/seller/orders')
          .set('Authorization', `Bearer ${sellerAToken}`)
          .expect(200);
        const mine = res.body.items.find(
          (so: { orderId: string; status: string }) =>
            so.orderId === orderId && so.status === 'PROCESSING',
        );
        return mine ?? null;
      });
      expect(sellerOrderRes.status).toBe('PROCESSING');
    });

    it('the customer order view omits seller commission/net financial fields', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
      expect(res.body.sellerOrders[0]).not.toHaveProperty('commissionAmount');
      expect(res.body.sellerOrders[0]).not.toHaveProperty('sellerNetAmount');
    });

    it('the admin order view has full financial visibility', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.sellerOrders).toHaveLength(2);
      expect(res.body.sellerOrders[0]).toHaveProperty('commissionAmount');
    });

    it('the updated stock eventually reflects in the search index (outbox flow, not a direct write)', async () => {
      await waitFor(async () => {
        const res = await request(app.getHttpServer()).get(
          `/api/products?search=${encodeURIComponent(`Flow Gadget A ${runId}`)}`,
        );
        const hit = res.body.data?.find(
          (p: { id: string; stockQuantity: number }) => p.id === productAId,
        );
        return hit?.stockQuantity === 8 ? hit : null;
      });
    });

    describe('(e) IDOR across customer/seller/admin boundaries', () => {
      let otherCustomerToken: string;
      let otherSellerToken: string;

      it('sets up an unrelated customer and seller', async () => {
        const other = await registerCustomer('flow-idor-customer');
        otherCustomerToken = other.accessToken;
        const otherSeller = await createApprovedSeller('flow-idor-seller');
        otherSellerToken = otherSeller.accessToken;
      });

      it('another customer cannot view this order (404, not leaked)', async () => {
        await request(app.getHttpServer())
          .get(`/api/orders/${orderId}`)
          .set('Authorization', `Bearer ${otherCustomerToken}`)
          .expect(404);
      });

      it('a customer cannot access seller or admin order routes (403)', async () => {
        await request(app.getHttpServer())
          .get('/api/seller/orders')
          .set('Authorization', `Bearer ${buyerToken}`)
          .expect(403);
        await request(app.getHttpServer())
          .get('/api/admin/orders')
          .set('Authorization', `Bearer ${buyerToken}`)
          .expect(403);
      });

      it("an unrelated seller cannot view seller A's seller-order (404)", async () => {
        const listRes = await request(app.getHttpServer())
          .get('/api/seller/orders')
          .set('Authorization', `Bearer ${sellerAToken}`)
          .expect(200);
        const sellerOrderId = listRes.body.items[0].id;

        await request(app.getHttpServer())
          .get(`/api/seller/orders/${sellerOrderId}`)
          .set('Authorization', `Bearer ${otherSellerToken}`)
          .expect(404);
      });

      it('a seller cannot access admin order routes (403)', async () => {
        await request(app.getHttpServer())
          .get('/api/admin/orders')
          .set('Authorization', `Bearer ${sellerAToken}`)
          .expect(403);
      });

      it('unauthenticated requests to every order route are rejected with 401', async () => {
        await request(app.getHttpServer()).get('/api/orders').expect(401);
        await request(app.getHttpServer())
          .get('/api/seller/orders')
          .expect(401);
        await request(app.getHttpServer()).get('/api/admin/orders').expect(401);
        await request(app.getHttpServer())
          .post('/api/cart/checkout')
          .expect(401);
      });
    });

    describe('(f) outbox duplicate-delivery idempotency', () => {
      it('exactly one ProcessedEvent row exists per SELLER_ORDER_CREATED event, despite BullMQ at-least-once delivery', async () => {
        const events = await outboxEventsRepository.find({
          where: [
            { aggregateId: sellerOrderAId, eventType: 'SELLER_ORDER_CREATED' },
            { aggregateId: sellerOrderBId, eventType: 'SELLER_ORDER_CREATED' },
          ],
        });
        expect(events).toHaveLength(2);

        for (const event of events) {
          const count = await processedEventsRepository.count({
            where: {
              consumerName: 'seller-order-processing',
              outboxEventId: event.id,
            },
          });
          expect(count).toBe(1);
        }
      });
    });
  });

  describe('(b) atomic multi-seller rollback on partial stock failure', () => {
    it('rejects the whole checkout and rolls back already-decremented stock when one seller lacks stock', async () => {
      const buyer = await registerCustomer('atomic-buyer');
      const sellerA = await createApprovedSeller('atomic-seller-a');
      const sellerB = await createApprovedSeller('atomic-seller-b');

      const productAId = await createProduct(sellerA.accessToken, categoryId, {
        name: `Atomic Gadget A ${runId}`,
        price: '10.00',
        stockQuantity: 5,
      });
      const productBId = await createProduct(sellerB.accessToken, categoryId, {
        name: `Atomic Gadget B ${runId}`,
        price: '10.00',
        stockQuantity: 5,
      });

      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .send({ productId: productAId, quantity: 1 })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .send({ productId: productBId, quantity: 1 })
        .expect(201);

      // Simulate a race: seller B's stock drops to 0 after the item was
      // added to the cart but before checkout runs.
      await request(app.getHttpServer())
        .patch(`/api/seller/products/${productBId}`)
        .set('Authorization', `Bearer ${sellerB.accessToken}`)
        .send({ stockQuantity: 0 })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/cart/checkout')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .set('Idempotency-Key', `atomic-checkout-${runId}`)
        .send({})
        .expect(409);

      const productA = await request(app.getHttpServer())
        .get(`/api/products/${productAId}`)
        .expect(200);
      expect(productA.body.stockQuantity).toBe(5); // rolled back, not 4

      const cartRes = await request(app.getHttpServer())
        .get('/api/cart')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .expect(200);
      expect(
        cartRes.body.sellers.flatMap((g: { items: unknown[] }) => g.items),
      ).toHaveLength(2); // cart untouched

      const ordersRes = await request(app.getHttpServer())
        .get('/api/orders')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .expect(200);
      expect(ordersRes.body.total).toBe(0); // no partial order
    });
  });

  describe('(c) concurrent checkout on limited stock', () => {
    it('exactly N buyers succeed when M > N buyers race for N units of stock', async () => {
      const seller = await createApprovedSeller('concurrency-seller');
      const productId = await createProduct(seller.accessToken, categoryId, {
        name: `Concurrency Gadget ${runId}`,
        price: '25.00',
        stockQuantity: 3,
      });

      const buyerCount = 10;
      const buyers = await Promise.all(
        Array.from({ length: buyerCount }, (_, i) =>
          registerCustomer(`concurrency-buyer-${i}`),
        ),
      );

      await Promise.all(
        buyers.map((buyer) =>
          request(app.getHttpServer())
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${buyer.accessToken}`)
            .send({ productId, quantity: 1 })
            .expect(201),
        ),
      );

      const outcomes = await Promise.allSettled(
        buyers.map((buyer, i) =>
          request(app.getHttpServer())
            .post('/api/cart/checkout')
            .set('Authorization', `Bearer ${buyer.accessToken}`)
            .set('Idempotency-Key', `concurrency-checkout-${runId}-${i}`)
            .send({}),
        ),
      );

      const succeeded = outcomes.filter(
        (o) => o.status === 'fulfilled' && o.value.status === 201,
      ).length;
      expect(succeeded).toBe(3);

      const product = await request(app.getHttpServer())
        .get(`/api/products/${productId}`)
        .expect(200);
      expect(product.body.stockQuantity).toBe(0);
    });
  });

  describe('(d) idempotency', () => {
    it('a duplicate sequential checkout with the same Idempotency-Key replays the same order', async () => {
      const buyer = await registerCustomer('idem-buyer');
      const seller = await createApprovedSeller('idem-seller');
      const productId = await createProduct(seller.accessToken, categoryId, {
        name: `Idempotency Gadget ${runId}`,
        price: '15.00',
        stockQuantity: 5,
      });
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .send({ productId, quantity: 1 })
        .expect(201);

      const first = await request(app.getHttpServer())
        .post('/api/cart/checkout')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .set('Idempotency-Key', `idem-sequential-${runId}`)
        .send({})
        .expect(201);
      expect(first.body.replayed).toBe(false);

      const second = await request(app.getHttpServer())
        .post('/api/cart/checkout')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .set('Idempotency-Key', `idem-sequential-${runId}`)
        .send({})
        .expect(201);
      expect(second.body.orderId).toBe(first.body.orderId);
      expect(second.body.replayed).toBe(true);

      const ordersRes = await request(app.getHttpServer())
        .get('/api/orders')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .expect(200);
      expect(ordersRes.body.total).toBe(1);
    });

    it('simultaneous duplicate requests with the same Idempotency-Key resolve to a single order', async () => {
      const buyer = await registerCustomer('idem-race-buyer');
      const seller = await createApprovedSeller('idem-race-seller');
      const productId = await createProduct(seller.accessToken, categoryId, {
        name: `Idempotency Race Gadget ${runId}`,
        price: '30.00',
        stockQuantity: 5,
      });
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .send({ productId, quantity: 1 })
        .expect(201);

      const outcomes = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          request(app.getHttpServer())
            .post('/api/cart/checkout')
            .set('Authorization', `Bearer ${buyer.accessToken}`)
            .set('Idempotency-Key', `idem-race-${runId}`)
            .send({}),
        ),
      );

      const orderIds = new Set(
        outcomes
          .filter(
            (o): o is PromiseFulfilledResult<request.Response> =>
              o.status === 'fulfilled' && o.value.status === 201,
          )
          .map((o) => o.value.body.orderId),
      );
      expect(orderIds.size).toBe(1);

      const ordersRes = await request(app.getHttpServer())
        .get('/api/orders')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .expect(200);
      expect(ordersRes.body.total).toBe(1);
    });

    it('rejects checkout with no Idempotency-Key header', async () => {
      const buyer = await registerCustomer('idem-missing-buyer');
      await request(app.getHttpServer())
        .post('/api/cart/checkout')
        .set('Authorization', `Bearer ${buyer.accessToken}`)
        .send({})
        .expect(400);
    });
  });
});
