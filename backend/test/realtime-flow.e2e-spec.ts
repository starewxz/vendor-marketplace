/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- socket/supertest payloads */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import cookieParser from 'cookie-parser';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { SellerProfile } from '../src/modules/sellers/entities/seller-profile.entity';
import { UsersService } from '../src/modules/users/users.service';
import { UserRole } from '../src/modules/users/entities/user-role.enum';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../src/common/config/configuration';
import { MetricsRegistryService } from '../src/modules/metrics/metrics-registry.service';
import { RedisIoAdapter } from '../src/websocket/redis-io.adapter';

interface Account {
  userId: string;
  token: string;
}

describe('Realtime Outbox -> Socket.IO delivery (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;
  let users: UsersService;
  let jwt: JwtService;
  let sellerProfiles: Repository<SellerProfile>;
  const sockets: Socket[] = [];
  const runId = randomUUID().slice(0, 8);

  let admin: Account;
  let sellerA: Account & { sellerProfileId: string };
  let sellerB: Account & { sellerProfileId: string };
  let customerA: Account;
  let customerB: Account;
  let categoryId: string;
  let productId: string;
  let auctionId: string;
  let orderId: string;
  let sellerOrderId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    const config = moduleRef.get(ConfigService<AppConfig, true>);
    const socketAdapter = new RedisIoAdapter(
      app,
      config.get('redis.url', { infer: true }),
      moduleRef.get(MetricsRegistryService),
    );
    await socketAdapter.connectToRedis();
    app.useWebSocketAdapter(socketAdapter);
    await app.listen(0, '127.0.0.1');
    expect(socketAdapter.isRedisAdapterInstalled()).toBe(true);
    const address = (
      app.getHttpServer() as import('http').Server
    ).address() as {
      port: number;
    };
    baseUrl = `http://127.0.0.1:${address.port}`;
    users = moduleRef.get(UsersService);
    jwt = moduleRef.get(JwtService);
    sellerProfiles = moduleRef.get(getRepositoryToken(SellerProfile));

    admin = await account(UserRole.ADMIN, 'admin');
    customerA = await account(UserRole.CUSTOMER, 'customer-a');
    customerB = await account(UserRole.CUSTOMER, 'customer-b');
    sellerA = await sellerAccount('seller-a');
    sellerB = await sellerAccount('seller-b');

    const category = await request(app.getHttpServer())
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: `Realtime ${runId}` })
      .expect(201);
    categoryId = category.body.id as string;

    const fixedProduct = await request(app.getHttpServer())
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send({
        name: `Realtime stock ${runId}`,
        categoryId,
        type: 'FIXED_PRICE',
        price: '25.00',
        stockQuantity: 2,
      })
      .expect(201);
    productId = fixedProduct.body.id as string;

    const auctionProduct = await request(app.getHttpServer())
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send({
        name: `Realtime auction ${runId}`,
        categoryId,
        type: 'AUCTION',
        price: '100.00',
        stockQuantity: 1,
      })
      .expect(201);
    const auction = await request(app.getHttpServer())
      .post('/api/seller/auctions')
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send({
        productId: auctionProduct.body.id,
        startPrice: '100.00',
        minBidIncrement: '10.00',
        startsAt: new Date(Date.now() - 5_000).toISOString(),
        endsAt: new Date(Date.now() + 120_000).toISOString(),
      })
      .expect(201);
    auctionId = auction.body.id as string;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    if (app) await app.close();
  });

  async function account(role: UserRole, label: string): Promise<Account> {
    const user = await users.create({
      email: `realtime-${label}-${runId}@example.com`,
      passwordHash: null,
      firstName: 'Realtime',
      lastName: label,
      role,
      isEmailVerified: true,
    });
    return {
      userId: user.id,
      token: await jwt.signAsync({ sub: user.id, email: user.email, role }),
    };
  }

  async function sellerAccount(
    label: string,
  ): Promise<Account & { sellerProfileId: string }> {
    const result = await account(UserRole.SELLER, label);
    const profile = await sellerProfiles.save(
      sellerProfiles.create({
        userId: result.userId,
        storeName: `Realtime ${label} ${runId}`,
        storeSlug: `realtime-${label}-${runId}`,
        commissionRatePercent: '10.00',
      }),
    );
    return { ...result, sellerProfileId: profile.id };
  }

  async function connect(token?: string): Promise<Socket> {
    const socket = io(baseUrl, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
  }

  function subscribe(socket: Socket, event: string, id: string) {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      socket.emit(event, { id }, resolve);
    });
  }

  function nextEvent<T>(
    socket: Socket,
    event: string,
    predicate: (payload: T) => boolean,
    timeoutMs = 15_000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off(event, listener);
        reject(new Error(`Timed out waiting for ${event}`));
      }, timeoutMs);
      const listener = (payload: T) => {
        if (!predicate(payload)) return;
        clearTimeout(timeout);
        socket.off(event, listener);
        resolve(payload);
      };
      socket.on(event, listener);
    });
  }

  async function waitForProcessing(): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const response = await request(app.getHttpServer())
        .get(`/api/seller/orders/${sellerOrderId}`)
        .set('Authorization', `Bearer ${sellerA.token}`);
      if (response.body.status === 'PROCESSING') return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('SellerOrder did not reach PROCESSING');
  }

  it('broadcasts committed stock and REST returns the same authoritative value', async () => {
    const viewer = await connect();
    expect(await subscribe(viewer, 'subscribe:product', productId)).toEqual(
      expect.objectContaining({ ok: true }),
    );
    const stockEvent = nextEvent<{ productId: string; stock: number }>(
      viewer,
      'product.stock.updated',
      (payload) => payload.productId === productId && payload.stock === 1,
    );

    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${customerA.token}`)
      .send({ productId, quantity: 1 })
      .expect(201);
    const checkout = await request(app.getHttpServer())
      .post('/api/cart/checkout')
      .set('Authorization', `Bearer ${customerA.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(201);
    orderId = checkout.body.orderId as string;
    sellerOrderId = checkout.body.sellerOrders[0].id as string;

    expect(await stockEvent).toMatchObject({ productId, stock: 1 });
    const authoritative = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .expect(200);
    expect(authoritative.body.stockQuantity).toBe(1);
  });

  it('broadcasts an accepted auction bid to every subscribed viewer', async () => {
    const bidder = await connect(customerA.token);
    const viewer = await connect(customerB.token);
    await subscribe(bidder, 'subscribe:auction', auctionId);
    await subscribe(viewer, 'subscribe:auction', auctionId);
    const update = nextEvent<{
      auctionId: string;
      currentPrice: string;
      minimumNextBid: string;
      bidCount: number;
    }>(
      viewer,
      'auction.bid.updated',
      (payload) => payload.auctionId === auctionId,
    );

    await request(app.getHttpServer())
      .post(`/api/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${customerA.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ amount: '100.00' })
      .expect(201);

    expect(await update).toMatchObject({
      auctionId,
      currentPrice: '100.00',
      minimumNextBid: '110.00',
      bidCount: 1,
    });
  });

  it('delivers order status only to the owning customer and seller rooms', async () => {
    await waitForProcessing();
    const customerSocket = await connect(customerA.token);
    const unrelatedCustomer = await connect(customerB.token);
    const unrelatedSeller = await connect(sellerB.token);

    expect(
      await subscribe(unrelatedCustomer, 'subscribe:order', orderId),
    ).toEqual({ ok: false, error: 'Order not found' });
    expect(
      await new Promise<{ ok: boolean; error?: string }>((resolve) =>
        unrelatedCustomer.emit(
          'subscribe:order',
          { id: orderId, userId: customerA.userId },
          resolve,
        ),
      ),
    ).toEqual({ ok: false, error: 'Order not found' });

    const customerUpdate = nextEvent<{
      orderId: string;
      sellerOrderId: string;
      sellerOrderStatus: string;
      aggregateOrderStatus: string;
    }>(
      customerSocket,
      'order.status.updated',
      (payload) =>
        payload.sellerOrderId === sellerOrderId &&
        payload.sellerOrderStatus === 'SHIPPED',
    );
    let leaked = false;
    unrelatedSeller.on('order.status.updated', () => {
      leaked = true;
    });

    await request(app.getHttpServer())
      .patch(`/api/seller/orders/${sellerOrderId}/status`)
      .set('Authorization', `Bearer ${sellerA.token}`)
      .send({ status: 'SHIPPED' })
      .expect(200);

    expect(await customerUpdate).toMatchObject({
      orderId,
      sellerOrderId,
      sellerOrderStatus: 'SHIPPED',
      aggregateOrderStatus: 'SHIPPED',
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(leaked).toBe(false);
  });

  it('rejects an invalid authenticated socket and anonymous private rooms', async () => {
    const invalid = io(baseUrl, {
      auth: { token: 'invalid.jwt' },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(invalid);
    await expect(
      new Promise((resolve, reject) => {
        invalid.once('connect', () => reject(new Error('unexpected connect')));
        invalid.once('connect_error', (error) => resolve(error.message));
      }),
    ).resolves.toBe('Unauthorized');

    const publicSocket = await connect();
    expect(await subscribe(publicSocket, 'subscribe:order', orderId)).toEqual({
      ok: false,
      error: 'Authentication required',
    });
  });

  it('exports realtime connection and delivery metrics', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/metrics')
      .expect(200);

    expect(response.text).toContain(
      '# TYPE websocket_connections_total counter',
    );
    expect(response.text).toMatch(/websocket_connections_total [1-9]\d*/);
    expect(response.text).toContain(
      '# TYPE websocket_connections_current gauge',
    );
    expect(response.text).toContain(
      '# TYPE websocket_events_emitted_total counter',
    );
  });
});
