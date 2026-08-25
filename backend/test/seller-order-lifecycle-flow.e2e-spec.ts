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

/**
 * Requires live Postgres/Redis/Meilisearch (`docker compose up`) with
 * migrations applied. Exercises Stage 5's post-checkout lifecycle: seller
 * status progression, parent Order aggregation, independent SellerOrder
 * cancellation (stock restore + ledger reversal), cancellation idempotency
 * under true concurrency, partial refunds (calculation + idempotency +
 * over-refund rejection), invalid transition rejection, and IDOR across
 * customer/seller/admin boundaries for every new endpoint.
 *
 * The `backend-e2e` CI job runs every `*.e2e-spec.ts` file (including this
 * one) against real services — see README "CI".
 */
describe('Seller order lifecycle + cancellation + refund flow (e2e)', () => {
  let app: INestApplication<App>;
  let usersService: UsersService;
  let jwtService: JwtService;
  let sellerProfilesRepository: Repository<SellerProfile>;
  let ledgerEntriesRepository: Repository<LedgerEntry>;
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
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // Same rationale as checkout-flow.e2e-spec.ts: fixture setup mints JWTs
  // directly rather than driving the throttled /auth/register|login
  // endpoints for every test account.
  async function mintAccessToken(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<string> {
    return jwtService.signAsync({ sub: userId, email, role });
  }

  async function registerCustomer(
    prefix: string,
  ): Promise<{ accessToken: string; userId: string }> {
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
  ): Promise<{ accessToken: string; sellerProfileId: string; userId: string }> {
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
        commissionRatePercent: '10.00',
      }),
    );
    const accessToken = await mintAccessToken(user.id, user.email, user.role);
    return { accessToken, sellerProfileId: profile.id, userId: user.id };
  }

  async function createProduct(
    sellerToken: string,
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

  let idempotencyCounter = 0;
  function nextIdempotencyKey(prefix: string): string {
    idempotencyCounter += 1;
    return `${prefix}-${runId}-${idempotencyCounter}`;
  }

  /** Buyer checks out a single product from a single seller; returns the
   * resulting orderId/sellerOrderId/sellerOrderItemId. */
  async function checkoutOneItem(
    buyerToken: string,
    productId: string,
    quantity: number,
  ): Promise<{
    orderId: string;
    sellerOrderId: string;
    sellerOrderItemId: string;
  }> {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId, quantity })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/cart/checkout')
      .set('Authorization', `Bearer ${buyerToken}`)
      .set('Idempotency-Key', nextIdempotencyKey('checkout'))
      .send({})
      .expect(201);

    const orderId = res.body.orderId;
    const sellerOrderId = res.body.sellerOrders[0].id;

    // Admin's seller-order detail view is the one place that exposes each
    // item's own id (needed as :sellerOrderItemId for refund requests).
    const sellerOrderDetail = await request(app.getHttpServer())
      .get(`/api/admin/seller-orders/${sellerOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    return {
      orderId,
      sellerOrderId,
      sellerOrderItemId: sellerOrderDetail.body.items[0].id,
    };
  }

  let adminToken: string;
  let categoryId: string;

  it('sets up an admin and a shared category', async () => {
    const email = `lifecycle-admin-${runId}@example.com`;
    const admin = await usersService.create({
      email,
      passwordHash: null,
      firstName: 'Lifecycle',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      isEmailVerified: true,
    });
    adminToken = await mintAccessToken(admin.id, admin.email, admin.role);

    const categoryRes = await request(app.getHttpServer())
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Lifecycle Category ${runId}` })
      .expect(201);
    categoryId = categoryRes.body.id;
  });

  describe('(a) independent SellerOrder cancellation + parent aggregation', () => {
    let buyerToken: string;
    let sellerAToken: string;
    let sellerBToken: string;
    let productAId: string;
    let productBId: string;
    let orderId: string;
    let sellerOrderAId: string;
    let sellerOrderBId: string;

    it('checkout across two sellers, then progress A while B stays behind', async () => {
      const buyer = await registerCustomer('indep-buyer');
      buyerToken = buyer.accessToken;
      const sellerA = await createApprovedSeller('indep-seller-a');
      sellerAToken = sellerA.accessToken;
      const sellerB = await createApprovedSeller('indep-seller-b');
      sellerBToken = sellerB.accessToken;

      productAId = await createProduct(sellerAToken, {
        name: `Indep A ${runId}`,
        price: '50.00',
        stockQuantity: 10,
      });
      productBId = await createProduct(sellerBToken, {
        name: `Indep B ${runId}`,
        price: '30.00',
        stockQuantity: 10,
      });

      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId: productAId, quantity: 1 })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ productId: productBId, quantity: 1 })
        .expect(201);

      const checkoutRes = await request(app.getHttpServer())
        .post('/api/cart/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('Idempotency-Key', nextIdempotencyKey('checkout'))
        .send({})
        .expect(201);
      orderId = checkoutRes.body.orderId;
      const sellerOrderA = checkoutRes.body.sellerOrders.find(
        (s: { sellerProfileId: string }) =>
          s.sellerProfileId === sellerA.sellerProfileId,
      );
      const sellerOrderB = checkoutRes.body.sellerOrders.find(
        (s: { sellerProfileId: string }) =>
          s.sellerProfileId === sellerB.sellerProfileId,
      );
      sellerOrderAId = sellerOrderA.id;
      sellerOrderBId = sellerOrderB.id;

      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${sellerOrderAId}/status`)
        .set('Authorization', `Bearer ${sellerAToken}`)
        .send({ status: 'PROCESSING' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${sellerOrderAId}/status`)
        .set('Authorization', `Bearer ${sellerAToken}`)
        .send({ status: 'SHIPPED' })
        .expect(200);

      const orderAfter = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
      expect(orderAfter.body.status).toBe('PARTIALLY_SHIPPED');
    });

    it('cancelling SellerOrder B does not affect SellerOrder A', async () => {
      const productBStockBefore = (
        await request(app.getHttpServer()).get(`/api/products/${productBId}`)
      ).body.stockQuantity;

      await request(app.getHttpServer())
        .post(`/api/seller/orders/${sellerOrderBId}/cancel`)
        .set('Authorization', `Bearer ${sellerBToken}`)
        .expect(201);

      const sellerOrderB = await request(app.getHttpServer())
        .get(`/api/seller/orders/${sellerOrderBId}`)
        .set('Authorization', `Bearer ${sellerBToken}`)
        .expect(200);
      expect(sellerOrderB.body.status).toBe('CANCELLED');

      const sellerOrderA = await request(app.getHttpServer())
        .get(`/api/seller/orders/${sellerOrderAId}`)
        .set('Authorization', `Bearer ${sellerAToken}`)
        .expect(200);
      expect(sellerOrderA.body.status).toBe('SHIPPED'); // untouched

      const productB = await request(app.getHttpServer()).get(
        `/api/products/${productBId}`,
      );
      expect(productB.body.stockQuantity).toBe(productBStockBefore + 1);

      const productA = await request(app.getHttpServer()).get(
        `/api/products/${productAId}`,
      );
      expect(productA.body.stockQuantity).toBe(9); // untouched by B's cancellation

      const ledgerA = await ledgerEntriesRepository.find({
        where: { sellerOrderId: sellerOrderAId },
      });
      expect(ledgerA).toHaveLength(2); // only the original SALE_CREDIT + COMMISSION_DEBIT

      const orderAfter = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
      expect(orderAfter.body.status).toBe('PARTIALLY_CANCELLED');
    });
  });

  describe('(b) cancellation idempotency', () => {
    it('repeated and concurrent cancel requests restore stock and reverse the ledger exactly once', async () => {
      const buyer = await registerCustomer('cancel-idem-buyer');
      const seller = await createApprovedSeller('cancel-idem-seller');
      const productId = await createProduct(seller.accessToken, {
        name: `CancelIdem ${runId}`,
        price: '40.00',
        stockQuantity: 5,
      });
      const { sellerOrderId } = await checkoutOneItem(
        buyer.accessToken,
        productId,
        2,
      );

      const outcomes = await Promise.allSettled(
        Array.from({ length: 5 }).map(() =>
          request(app.getHttpServer())
            .post(`/api/seller/orders/${sellerOrderId}/cancel`)
            .set('Authorization', `Bearer ${seller.accessToken}`),
        ),
      );
      const allOk = outcomes.every(
        (o) =>
          o.status === 'fulfilled' &&
          (o.value as { status: number }).status === 201,
      );
      expect(allOk).toBe(true);

      const product = await request(app.getHttpServer()).get(
        `/api/products/${productId}`,
      );
      expect(product.body.stockQuantity).toBe(5); // fully restored, exactly once

      const ledger = await ledgerEntriesRepository.find({
        where: { sellerOrderId },
      });
      expect(ledger).toHaveLength(4); // 2 original + 2 reversal, never doubled

      // A subsequent sequential call is still a safe no-op.
      await request(app.getHttpServer())
        .post(`/api/seller/orders/${sellerOrderId}/cancel`)
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .expect(201);
      const ledgerAfterAnotherCall = await ledgerEntriesRepository.find({
        where: { sellerOrderId },
      });
      expect(ledgerAfterAnotherCall).toHaveLength(4);
    });
  });

  describe('(f) invalid status transitions', () => {
    it('rejects DELIVERED -> PROCESSING and CANCELLED -> SHIPPED without corrupting state', async () => {
      const buyer = await registerCustomer('invalid-transition-buyer');
      const seller = await createApprovedSeller('invalid-transition-seller');
      const productId = await createProduct(seller.accessToken, {
        name: `InvalidTransition ${runId}`,
        price: '15.00',
        stockQuantity: 5,
      });
      const { sellerOrderId } = await checkoutOneItem(
        buyer.accessToken,
        productId,
        1,
      );

      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${sellerOrderId}/status`)
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .send({ status: 'PROCESSING' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${sellerOrderId}/status`)
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .send({ status: 'SHIPPED' })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${sellerOrderId}/status`)
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .send({ status: 'DELIVERED' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${sellerOrderId}/status`)
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .send({ status: 'PROCESSING' })
        .expect(409);

      const stillDelivered = await request(app.getHttpServer())
        .get(`/api/seller/orders/${sellerOrderId}`)
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .expect(200);
      expect(stillDelivered.body.status).toBe('DELIVERED');

      // Cancellation from DELIVERED is also rejected (past the cancellable window).
      await request(app.getHttpServer())
        .post(`/api/seller/orders/${sellerOrderId}/cancel`)
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .expect(409);
    });
  });

  describe('(c)+(e) partial refund, calculation, and over-refund rejection', () => {
    let sellerToken: string;
    let sellerOrderId: string;
    let sellerOrderItemId: string;
    let productId: string;

    it('sets up a DELIVERED seller order with quantity 2', async () => {
      const buyer = await registerCustomer('refund-buyer');
      const seller = await createApprovedSeller('refund-seller');
      sellerToken = seller.accessToken;
      productId = await createProduct(sellerToken, {
        name: `RefundItem ${runId}`,
        price: '100.00',
        stockQuantity: 10,
      });

      const result = await checkoutOneItem(buyer.accessToken, productId, 2);
      sellerOrderId = result.sellerOrderId;
      sellerOrderItemId = result.sellerOrderItemId;

      for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED']) {
        await request(app.getHttpServer())
          .patch(`/api/seller/orders/${sellerOrderId}/status`)
          .set('Authorization', `Bearer ${sellerToken}`)
          .send({ status })
          .expect(200);
      }
    });

    it('creates a partial refund with server-computed amount/commission/seller correction', async () => {
      const stockBefore = (
        await request(app.getHttpServer()).get(`/api/products/${productId}`)
      ).body.stockQuantity;

      const res = await request(app.getHttpServer())
        .post(`/api/admin/seller-orders/${sellerOrderId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', nextIdempotencyKey('refund'))
        .send({ sellerOrderItemId, quantity: 1, reason: 'Customer request' })
        .expect(201);

      expect(res.body.amount).toBe('100.00');
      expect(res.body.commissionAdjustment).toBe('10.00');
      expect(res.body.sellerAdjustment).toBe('90.00');

      const stockAfter = (
        await request(app.getHttpServer()).get(`/api/products/${productId}`)
      ).body.stockQuantity;
      expect(stockAfter).toBe(stockBefore + 1);

      const sellerOrder = await request(app.getHttpServer())
        .get(`/api/seller/orders/${sellerOrderId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);
      expect(sellerOrder.body.financials.effectiveSubtotal).toBe('100.00');
      expect(sellerOrder.body.financials.effectiveCommission).toBe('10.00');
      expect(sellerOrder.body.financials.effectiveSellerNet).toBe('90.00');
    });

    it('rejects refunding more than what remains (only 1 of 2 units left)', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/seller-orders/${sellerOrderId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', nextIdempotencyKey('refund'))
        .send({ sellerOrderItemId, quantity: 2 })
        .expect(409);

      const refunds = await request(app.getHttpServer())
        .get(`/api/admin/seller-orders/${sellerOrderId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(refunds.body).toHaveLength(1); // the rejected attempt created nothing
    });

    it('refunding exactly the remaining quantity succeeds, then a further refund is rejected (0 remaining)', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/seller-orders/${sellerOrderId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', nextIdempotencyKey('refund'))
        .send({ sellerOrderItemId, quantity: 1 })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/admin/seller-orders/${sellerOrderId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', nextIdempotencyKey('refund'))
        .send({ sellerOrderItemId, quantity: 1 })
        .expect(409);
    });

    it('rejects a refund request with no Idempotency-Key header', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/seller-orders/${sellerOrderId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sellerOrderItemId, quantity: 1 })
        .expect(400);
    });
  });

  describe('(d) refund idempotency', () => {
    it('sequential and simultaneous duplicate refund requests produce exactly one Refund', async () => {
      const buyer = await registerCustomer('refund-idem-buyer');
      const seller = await createApprovedSeller('refund-idem-seller');
      const productId = await createProduct(seller.accessToken, {
        name: `RefundIdem ${runId}`,
        price: '25.00',
        stockQuantity: 10,
      });
      const { sellerOrderId, sellerOrderItemId } = await checkoutOneItem(
        buyer.accessToken,
        productId,
        3,
      );

      for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED']) {
        await request(app.getHttpServer())
          .patch(`/api/seller/orders/${sellerOrderId}/status`)
          .set('Authorization', `Bearer ${seller.accessToken}`)
          .send({ status })
          .expect(200);
      }

      const key = nextIdempotencyKey('refund-seq');
      const first = await request(app.getHttpServer())
        .post(`/api/admin/seller-orders/${sellerOrderId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', key)
        .send({ sellerOrderItemId, quantity: 1 })
        .expect(201);
      const second = await request(app.getHttpServer())
        .post(`/api/admin/seller-orders/${sellerOrderId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', key)
        .send({ sellerOrderItemId, quantity: 1 })
        .expect(201);
      expect(second.body.id).toBe(first.body.id);

      const concurrentKey = nextIdempotencyKey('refund-concurrent');
      const outcomes = await Promise.allSettled(
        Array.from({ length: 5 }).map(() =>
          request(app.getHttpServer())
            .post(`/api/admin/seller-orders/${sellerOrderId}/refunds`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('Idempotency-Key', concurrentKey)
            .send({ sellerOrderItemId, quantity: 1 }),
        ),
      );
      const refundIds = new Set(
        outcomes
          .filter(
            (o): o is PromiseFulfilledResult<request.Response> =>
              o.status === 'fulfilled' && o.value.status === 201,
          )
          .map((o) => o.value.body.id),
      );
      expect(refundIds.size).toBe(1);

      const allRefunds = await request(app.getHttpServer())
        .get(`/api/admin/seller-orders/${sellerOrderId}/refunds`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(allRefunds.body).toHaveLength(2); // one from each distinct idempotency key
    });
  });

  describe('(g) IDOR across customer/seller/admin boundaries', () => {
    let sellerAToken: string;
    let sellerBToken: string;
    let sellerOrderAId: string;
    let buyerToken: string;
    let customerOrderId: string;

    it('sets up two sellers and a checked-out order', async () => {
      const buyer = await registerCustomer('idor-buyer');
      buyerToken = buyer.accessToken;
      const sellerA = await createApprovedSeller('idor-seller-a');
      sellerAToken = sellerA.accessToken;
      const sellerB = await createApprovedSeller('idor-seller-b');
      sellerBToken = sellerB.accessToken;
      const productId = await createProduct(sellerAToken, {
        name: `Idor ${runId}`,
        price: '10.00',
        stockQuantity: 5,
      });
      const result = await checkoutOneItem(buyerToken, productId, 1);
      sellerOrderAId = result.sellerOrderId;
      customerOrderId = result.orderId;
    });

    it("seller B cannot read, update, or cancel seller A's seller order (404)", async () => {
      await request(app.getHttpServer())
        .get(`/api/seller/orders/${sellerOrderAId}`)
        .set('Authorization', `Bearer ${sellerBToken}`)
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${sellerOrderAId}/status`)
        .set('Authorization', `Bearer ${sellerBToken}`)
        .send({ status: 'PROCESSING' })
        .expect(404);
      await request(app.getHttpServer())
        .post(`/api/seller/orders/${sellerOrderAId}/cancel`)
        .set('Authorization', `Bearer ${sellerBToken}`)
        .expect(404);
    });

    it('a customer cannot change SellerOrder status or create a refund', async () => {
      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${sellerOrderAId}/status`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ status: 'PROCESSING' })
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/admin/seller-orders/${sellerOrderAId}/refunds`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('Idempotency-Key', nextIdempotencyKey('idor-refund'))
        .send({ sellerOrderItemId: 'irrelevant', quantity: 1 })
        .expect(403);
    });

    it('a seller cannot create a refund through the admin endpoint', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/seller-orders/${sellerOrderAId}/refunds`)
        .set('Authorization', `Bearer ${sellerAToken}`)
        .set('Idempotency-Key', nextIdempotencyKey('idor-refund'))
        .send({ sellerOrderItemId: 'irrelevant', quantity: 1 })
        .expect(403);
    });

    it("another customer cannot access this customer's order", async () => {
      const otherBuyer = await registerCustomer('idor-other-buyer');
      await request(app.getHttpServer())
        .get(`/api/orders/${customerOrderId}`)
        .set('Authorization', `Bearer ${otherBuyer.accessToken}`)
        .expect(404);
    });

    it('unauthenticated requests to every new endpoint are rejected with 401', async () => {
      await request(app.getHttpServer())
        .patch(`/api/seller/orders/${sellerOrderAId}/status`)
        .send({ status: 'PROCESSING' })
        .expect(401);
      await request(app.getHttpServer())
        .post(`/api/seller/orders/${sellerOrderAId}/cancel`)
        .expect(401);
      await request(app.getHttpServer())
        .patch(`/api/admin/seller-orders/${sellerOrderAId}/status`)
        .send({ status: 'PROCESSING' })
        .expect(401);
      await request(app.getHttpServer())
        .post(`/api/admin/seller-orders/${sellerOrderAId}/cancel`)
        .expect(401);
      await request(app.getHttpServer())
        .post(`/api/admin/seller-orders/${sellerOrderAId}/refunds`)
        .send({})
        .expect(401);
    });

    it('admin can inspect, update, and cancel any seller order', async () => {
      await request(app.getHttpServer())
        .get(`/api/admin/seller-orders/${sellerOrderAId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/admin/seller-orders/${sellerOrderAId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PROCESSING' })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/admin/seller-orders/${sellerOrderAId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
    });
  });
});
