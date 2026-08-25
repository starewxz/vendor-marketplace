/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- supertest response bodies */
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
import { Auction } from '../src/modules/bidding/entities/auction.entity';
import { AuctionStatus } from '../src/modules/bidding/entities/auction-status.enum';
import { Bid } from '../src/modules/bidding/entities/bid.entity';
import { Product } from '../src/modules/products/entities/product.entity';
import { Order } from '../src/modules/orders/entities/order.entity';
import { LedgerEntry } from '../src/modules/payments-ledger/entities/ledger-entry.entity';
import { OutboxEvent } from '../src/modules/outbox/entities/outbox-event.entity';
import { AuctionLifecycleService } from '../src/modules/bidding/auction-lifecycle.service';

describe('Auction concurrency, finalization, and winner checkout (e2e)', () => {
  let app: INestApplication<App>;
  let users: UsersService;
  let jwt: JwtService;
  let lifecycle: AuctionLifecycleService;
  let sellers: Repository<SellerProfile>;
  let auctions: Repository<Auction>;
  let bids: Repository<Bid>;
  let products: Repository<Product>;
  let orders: Repository<Order>;
  let ledger: Repository<LedgerEntry>;
  let outbox: Repository<OutboxEvent>;
  const runId = randomUUID().slice(0, 8);

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
    await app.init();
    users = moduleRef.get(UsersService);
    jwt = moduleRef.get(JwtService);
    lifecycle = moduleRef.get(AuctionLifecycleService);
    sellers = moduleRef.get(getRepositoryToken(SellerProfile));
    auctions = moduleRef.get(getRepositoryToken(Auction));
    bids = moduleRef.get(getRepositoryToken(Bid));
    products = moduleRef.get(getRepositoryToken(Product));
    orders = moduleRef.get(getRepositoryToken(Order));
    ledger = moduleRef.get(getRepositoryToken(LedgerEntry));
    outbox = moduleRef.get(getRepositoryToken(OutboxEvent));
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  async function account(role: UserRole, label: string) {
    const user = await users.create({
      email: `auction-${label}-${runId}@example.com`,
      passwordHash: null,
      firstName: 'Auction',
      lastName: label,
      role,
      isEmailVerified: true,
    });
    return {
      user,
      token: await jwt.signAsync({ sub: user.id, email: user.email, role }),
    };
  }

  let sellerToken: string;
  let sellerUserId: string;
  let sellerProfileId: string;
  let otherSellerToken: string;
  let categoryId: string;
  let auctionId: string;
  let productId: string;
  let customerA: Awaited<ReturnType<typeof account>>;
  let customerB: Awaited<ReturnType<typeof account>>;

  it('creates an owned AUCTION product and active auction', async () => {
    const admin = await account(UserRole.ADMIN, 'admin');
    const seller = await account(UserRole.SELLER, 'seller');
    sellerToken = seller.token;
    sellerUserId = seller.user.id;
    const sellerProfile = await sellers.save(
      sellers.create({
        userId: seller.user.id,
        storeName: `Auction Store ${runId}`,
        storeSlug: `auction-store-${runId}`,
        commissionRatePercent: '10.00',
      }),
    );
    sellerProfileId = sellerProfile.id;
    const otherSeller = await account(UserRole.SELLER, 'other-seller');
    otherSellerToken = otherSeller.token;
    await sellers.save(
      sellers.create({
        userId: otherSeller.user.id,
        storeName: `Other Auction Store ${runId}`,
        storeSlug: `other-auction-store-${runId}`,
      }),
    );
    customerA = await account(UserRole.CUSTOMER, 'buyer-a');
    customerB = await account(UserRole.CUSTOMER, 'buyer-b');

    const category = await request(app.getHttpServer())
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: `Auction Gear ${runId}` })
      .expect(201);
    categoryId = category.body.id;
    const product = await request(app.getHttpServer())
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: `One-off gadget ${runId}`,
        categoryId,
        type: 'AUCTION',
        price: '100.00',
        stockQuantity: 1,
      })
      .expect(201);
    productId = product.body.id;
    const created = await request(app.getHttpServer())
      .post('/api/seller/auctions')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        productId,
        startPrice: '100.00',
        minBidIncrement: '10.00',
        startsAt: new Date(Date.now() - 5_000).toISOString(),
        endsAt: new Date(Date.now() + 60_000).toISOString(),
      })
      .expect(201);
    auctionId = created.body.id;
    expect(created.body.status).toBe('ACTIVE');
  });

  it('enforces auction RBAC and ownership without leaking another seller auction', async () => {
    await request(app.getHttpServer())
      .post(`/api/auctions/${auctionId}/bids`)
      .set('Idempotency-Key', randomUUID())
      .send({ amount: '100.00' })
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/seller/auctions/${auctionId}`)
      .set('Authorization', `Bearer ${otherSellerToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/seller/auctions/${auctionId}`)
      .set('Authorization', `Bearer ${otherSellerToken}`)
      .send({ minBidIncrement: '20.00' })
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/seller/auctions')
      .set('Authorization', `Bearer ${customerA.token}`)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${customerA.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ amount: 'not-money' })
      .expect(400);
  });

  it('rejects the owner and serializes equal concurrent bids so exactly one opening bid wins', async () => {
    await request(app.getHttpServer())
      .post(`/api/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ amount: '100.00' })
      .expect(403);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: '100.00' }),
      request(app.getHttpServer())
        .post(`/api/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${customerB.token}`)
        .set('Idempotency-Key', randomUUID())
        .send({ amount: '100.00' }),
    ]);
    expect(responses.filter((res) => res.status === 201)).toHaveLength(1);
    expect(responses.filter((res) => res.status === 409)).toHaveLength(1);
    expect(await bids.count({ where: { auctionId, amount: '100.00' } })).toBe(
      1,
    );
  });

  it('keeps a consistent highest price under overlapping concurrent bids', async () => {
    const amounts = ['110.00', '120.00', '130.00', '140.00', '150.00'];
    await Promise.all(
      amounts.map((amount, index) =>
        request(app.getHttpServer())
          .post(`/api/auctions/${auctionId}/bids`)
          .set(
            'Authorization',
            `Bearer ${index % 2 ? customerA.token : customerB.token}`,
          )
          .set('Idempotency-Key', randomUUID())
          .send({ amount }),
      ),
    );
    const auction = await auctions.findOneByOrFail({ id: auctionId });
    expect(auction.currentPrice).toBe('150.00');
    expect(auction.winnerId).toBeTruthy();
  });

  it('treats simultaneous retries with one bid idempotency key as one logical bid', async () => {
    const key = `bid-replay-${runId}`;
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', key)
        .send({ amount: '160.00' }),
      request(app.getHttpServer())
        .post(`/api/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${customerA.token}`)
        .set('Idempotency-Key', key)
        .send({ amount: '160.00' }),
    ]);
    expect(responses.map((res) => res.status)).toEqual([201, 201]);
    expect(responses[0].body.bidId).toBe(responses[1].body.bidId);
    expect(
      await bids.count({
        where: { auctionId, bidderId: customerA.user.id, idempotencyKey: key },
      }),
    ).toBe(1);
  });

  it('finalizes once, opens a winner purchase window, and rejects a post-deadline bid', async () => {
    await auctions.update(auctionId, { endsAt: new Date(Date.now() - 1000) });
    await request(app.getHttpServer())
      .post(`/api/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${customerA.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ amount: '200.00' })
      .expect(409);
    await lifecycle.finalizeAuction(auctionId, randomUUID());
    await lifecycle.finalizeAuction(auctionId, randomUUID());
    const auction = await auctions.findOneByOrFail({ id: auctionId });
    expect(auction.status).toBe(AuctionStatus.AWAITING_PAYMENT);
    expect(auction.purchaseWindowEndsAt).not.toBeNull();
    expect(
      await outbox.count({
        where: { aggregateId: auctionId, eventType: 'AUCTION_WON' },
      }),
    ).toBe(1);
  });

  it('finalizes a scheduled auction with no bids as UNSOLD exactly once', async () => {
    const product = await request(app.getHttpServer())
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: `No-bid auction ${runId}`,
        categoryId,
        type: 'AUCTION',
        price: '75.00',
        stockQuantity: 1,
      })
      .expect(201);
    const created = await request(app.getHttpServer())
      .post('/api/seller/auctions')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        productId: product.body.id,
        startPrice: '75.00',
        minBidIncrement: '5.00',
        startsAt: new Date(Date.now() + 60_000).toISOString(),
        endsAt: new Date(Date.now() + 120_000).toISOString(),
      })
      .expect(201);
    const noBidAuctionId = created.body.id as string;
    await auctions.update(noBidAuctionId, {
      endsAt: new Date(Date.now() - 1000),
    });

    await lifecycle.finalizeAuction(noBidAuctionId, randomUUID());
    await lifecycle.finalizeAuction(noBidAuctionId, randomUUID());

    expect(
      (await auctions.findOneByOrFail({ id: noBidAuctionId })).status,
    ).toBe(AuctionStatus.UNSOLD);
    expect(
      await outbox.count({
        where: { aggregateId: noBidAuctionId, eventType: 'AUCTION_UNSOLD' },
      }),
    ).toBe(1);
  });

  it('allows only the winner to checkout and replays the same idempotency key without duplicate financial effects', async () => {
    const auction = await auctions.findOneByOrFail({ id: auctionId });
    const winner =
      auction.winnerId === customerA.user.id ? customerA : customerB;
    const loser = winner === customerA ? customerB : customerA;
    await request(app.getHttpServer())
      .post(`/api/auctions/${auctionId}/checkout`)
      .set('Authorization', `Bearer ${loser.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(403);

    const key = `auction-checkout-${runId}`;
    const first = await request(app.getHttpServer())
      .post(`/api/auctions/${auctionId}/checkout`)
      .set('Authorization', `Bearer ${winner.token}`)
      .set('Idempotency-Key', key)
      .send({})
      .expect(201);
    const replay = await request(app.getHttpServer())
      .post(`/api/auctions/${auctionId}/checkout`)
      .set('Authorization', `Bearer ${winner.token}`)
      .set('Idempotency-Key', key)
      .send({})
      .expect(201);
    expect(replay.body.orderId).toBe(first.body.orderId);
    expect(replay.body.replayed).toBe(true);
    expect(await orders.count({ where: { buyerId: winner.user.id } })).toBe(1);
    expect(await ledger.count({ where: { sellerProfileId } })).toBe(2);
    expect(
      (await products.findOneByOrFail({ id: productId })).stockQuantity,
    ).toBe(0);
    expect((await auctions.findOneByOrFail({ id: auctionId })).status).toBe(
      AuctionStatus.COMPLETED,
    );
    expect(sellerUserId).toBeTruthy();
  });

  it('expires an unpaid winner window idempotently and leaves stock available for seller relisting', async () => {
    const product = await request(app.getHttpServer())
      .post('/api/seller/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: `Unpaid auction ${runId}`,
        categoryId,
        type: 'AUCTION',
        price: '50.00',
        stockQuantity: 1,
      })
      .expect(201);
    const created = await request(app.getHttpServer())
      .post('/api/seller/auctions')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        productId: product.body.id,
        startPrice: '50.00',
        minBidIncrement: '5.00',
        startsAt: new Date(Date.now() - 5_000).toISOString(),
        endsAt: new Date(Date.now() + 60_000).toISOString(),
      })
      .expect(201);
    const unpaidAuctionId = created.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/auctions/${unpaidAuctionId}/bids`)
      .set('Authorization', `Bearer ${customerB.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ amount: '50.00' })
      .expect(201);
    await auctions.update(unpaidAuctionId, {
      endsAt: new Date(Date.now() - 1000),
    });
    await lifecycle.finalizeAuction(unpaidAuctionId, randomUUID());
    await auctions.update(unpaidAuctionId, {
      purchaseWindowEndsAt: new Date(Date.now() - 1000),
    });
    await lifecycle.expirePurchaseWindow(unpaidAuctionId, randomUUID());
    await lifecycle.expirePurchaseWindow(unpaidAuctionId, randomUUID());

    expect(
      (await auctions.findOneByOrFail({ id: unpaidAuctionId })).status,
    ).toBe(AuctionStatus.EXPIRED);
    expect(
      (await products.findOneByOrFail({ id: product.body.id as string }))
        .stockQuantity,
    ).toBe(1);
    expect(
      await outbox.count({
        where: {
          aggregateId: unpaidAuctionId,
          eventType: 'AUCTION_PURCHASE_WINDOW_EXPIRED',
        },
      }),
    ).toBe(1);
    await request(app.getHttpServer())
      .post(`/api/auctions/${unpaidAuctionId}/checkout`)
      .set('Authorization', `Bearer ${customerB.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(409);
  });
});
