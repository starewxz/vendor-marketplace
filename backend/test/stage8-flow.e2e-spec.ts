/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- supertest response bodies */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import type { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/modules/users/users.service';
import { UserRole } from '../src/modules/users/entities/user-role.enum';
import { SellerProfile } from '../src/modules/sellers/entities/seller-profile.entity';
import { Category } from '../src/modules/categories/entities/category.entity';
import { Product } from '../src/modules/products/entities/product.entity';
import { ProductType } from '../src/modules/products/entities/product-type.enum';
import { Order } from '../src/modules/orders/entities/order.entity';
import { OrderStatus } from '../src/modules/orders/entities/order-status.enum';
import { SellerOrder } from '../src/modules/orders/entities/seller-order.entity';
import { SellerOrderStatus } from '../src/modules/orders/entities/seller-order-status.enum';
import { SellerOrderItem } from '../src/modules/orders/entities/seller-order-item.entity';
import { LedgerEntry } from '../src/modules/payments-ledger/entities/ledger-entry.entity';
import { LedgerEntryType } from '../src/modules/payments-ledger/entities/ledger-entry-type.enum';
import { Refund } from '../src/modules/refunds/entities/refund.entity';

describe('Stage 8 verified reviews, disputes, refunds and analytics (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let users: UsersService;
  let sellers: Repository<SellerProfile>;
  let products: Repository<Product>;
  let refunds: Repository<Refund>;
  let customerToken: string;
  let strangerToken: string;
  let sellerToken: string;
  let otherSellerToken: string;
  let adminToken: string;
  let seller: SellerProfile;
  let product: Product;
  let sellerOrder: SellerOrder;
  let item: SellerOrderItem;
  const run = randomUUID().slice(0, 8);
  const startedAt = new Date().toISOString();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    jwt = module.get(JwtService);
    users = module.get(UsersService);
    sellers = module.get(getRepositoryToken(SellerProfile));
    products = module.get(getRepositoryToken(Product));
    refunds = module.get(getRepositoryToken(Refund));
    const account = async (role: UserRole, label: string) => {
      const user = await users.create({
        email: `${label}-${run}@example.com`,
        passwordHash: null,
        firstName: label,
        lastName: 'Tester',
        role,
        isEmailVerified: true,
      });
      return {
        user,
        token: await jwt.signAsync({ sub: user.id, email: user.email, role }),
      };
    };
    const customer = await account(UserRole.CUSTOMER, 'buyer');
    customerToken = customer.token;
    strangerToken = (await account(UserRole.CUSTOMER, 'stranger')).token;
    const sellerUser = await account(UserRole.SELLER, 'seller');
    sellerToken = sellerUser.token;
    const otherSellerUser = await account(UserRole.SELLER, 'other-seller');
    otherSellerToken = otherSellerUser.token;
    const admin = await account(UserRole.ADMIN, 'admin');
    adminToken = admin.token;
    seller = await sellers.save(
      sellers.create({
        userId: sellerUser.user.id,
        storeName: `Manifest ${run}`,
        storeSlug: `manifest-${run}`,
        commissionRatePercent: '10.00',
        isActive: true,
      }),
    );
    await sellers.save(
      sellers.create({
        userId: otherSellerUser.user.id,
        storeName: `Other ${run}`,
        storeSlug: `other-${run}`,
        commissionRatePercent: '10.00',
        isActive: true,
      }),
    );
    const categories = module.get<Repository<Category>>(
      getRepositoryToken(Category),
    );
    const category = await categories.save(
      categories.create({
        name: `Stage8 ${run}`,
        slug: `stage8-${run}`,
        parentId: null,
        iconUrl: null,
        sortOrder: 0,
        isActive: true,
      }),
    );
    product = await products.save(
      products.create({
        sellerProfileId: seller.id,
        categoryId: category.id,
        name: `Reviewable ${run}`,
        slug: `reviewable-${run}`,
        description: 'Verified review fixture',
        type: ProductType.FIXED_PRICE,
        price: '100.00',
        stockQuantity: 3,
        imageUrls: [],
        isPublished: true,
        ratingAverage: '0.00',
        ratingCount: 0,
      }),
    );
    const orders = module.get<Repository<Order>>(getRepositoryToken(Order));
    const order = await orders.save(
      orders.create({
        buyerId: customer.user.id,
        totalAmount: '200.00',
        status: OrderStatus.COMPLETED,
        shippingAddressLine1: null,
        shippingAddressLine2: null,
        shippingCity: null,
        shippingPostalCode: null,
        shippingCountry: null,
      }),
    );
    const sellerOrders = module.get<Repository<SellerOrder>>(
      getRepositoryToken(SellerOrder),
    );
    sellerOrder = await sellerOrders.save(
      sellerOrders.create({
        orderId: order.id,
        sellerProfileId: seller.id,
        subtotal: '200.00',
        commissionAmount: '20.00',
        sellerNetAmount: '180.00',
        status: SellerOrderStatus.DELIVERED,
      }),
    );
    const items = module.get<Repository<SellerOrderItem>>(
      getRepositoryToken(SellerOrderItem),
    );
    item = await items.save(
      items.create({
        sellerOrderId: sellerOrder.id,
        productId: product.id,
        productName: product.name,
        unitPrice: '100.00',
        quantity: 2,
        lineTotal: '200.00',
      }),
    );
    const ledger = module.get<Repository<LedgerEntry>>(
      getRepositoryToken(LedgerEntry),
    );
    await ledger.save([
      ledger.create({
        sellerProfileId: seller.id,
        type: LedgerEntryType.SALE_CREDIT,
        amount: '200.00',
        sellerOrderId: sellerOrder.id,
        refundId: null,
        description: 'fixture sale',
        correlationId: null,
      }),
      ledger.create({
        sellerProfileId: seller.id,
        type: LedgerEntryType.COMMISSION_DEBIT,
        amount: '20.00',
        sellerOrderId: sellerOrder.id,
        refundId: null,
        description: 'fixture commission',
        correlationId: null,
      }),
    ]);
  });
  afterAll(async () => app.close());

  it('enforces verified purchase review ownership and updates rating', async () => {
    await request(app.getHttpServer())
      .post(`/api/products/${product.id}/reviews`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({
        sellerOrderItemId: item.id,
        rating: 5,
        comment: 'Not my purchase at all',
      })
      .expect(403);
    const created = await request(app.getHttpServer())
      .post(`/api/products/${product.id}/reviews`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        sellerOrderItemId: item.id,
        rating: 4,
        comment: 'Arrived safely and matched the manifest.',
      })
      .expect(201);
    expect(created.body.rating).toBe(4);
    await request(app.getHttpServer())
      .post(`/api/products/${product.id}/reviews`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        sellerOrderItemId: item.id,
        rating: 5,
        comment: 'Duplicate purchase review',
      })
      .expect(409);
    const updated = await products.findOneByOrFail({ id: product.id });
    expect(updated.ratingCount).toBe(1);
    expect(updated.ratingAverage).toBe('4.00');
  });

  it('enforces dispute IDOR and coordinates a customer resolution with one refund', async () => {
    await request(app.getHttpServer())
      .post(`/api/seller-orders/${sellerOrder.id}/disputes`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({
        reason: 'Wrong order',
        description: 'This belongs to another customer.',
      })
      .expect(404);
    const opened = await request(app.getHttpServer())
      .post(`/api/seller-orders/${sellerOrder.id}/disputes`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        reason: 'Damaged item',
        description: 'One of the two units arrived damaged.',
      })
      .expect(201);
    const disputeId = opened.body.id as string;
    await request(app.getHttpServer())
      .get('/api/seller/disputes')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200)
      .expect((res) =>
        expect(
          res.body.data.some((d: { id: string }) => d.id === disputeId),
        ).toBe(true),
      );
    await request(app.getHttpServer())
      .get(`/api/seller/disputes/${disputeId}`)
      .set('Authorization', `Bearer ${otherSellerToken}`)
      .expect(404);
    const resolve = () =>
      request(app.getHttpServer())
        .post(`/api/admin/disputes/${disputeId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', `dispute-refund-${run}`)
        .send({
          outcome: 'CUSTOMER',
          adminResolution: 'Refund one damaged unit.',
          refund: {
            sellerOrderItemId: item.id,
            quantity: 1,
            reason: 'Damaged in transit',
          },
        });
    await resolve()
      .expect(201)
      .expect((res) => expect(res.body.status).toBe('RESOLVED_CUSTOMER'));
    await resolve().expect(201);
    expect(await refunds.count({ where: { disputeId } })).toBe(1);
    expect(
      (await products.findOneByOrFail({ id: product.id })).stockQuantity,
    ).toBe(4);
  });

  it('keeps analytics admin-only and ledger-derived after refund correction', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    const report = await request(app.getHttpServer())
      .get(`/api/admin/analytics?from=${encodeURIComponent(startedAt)}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Number(report.body.summary.platformRevenue)).toBeCloseTo(10, 2);
    expect(Number(report.body.summary.grossSales)).toBeCloseTo(100, 2);
    await request(app.getHttpServer())
      .get('/api/seller/analytics/overview')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200)
      .expect((res) =>
        expect(Number(res.body.summary.netRevenue)).toBeCloseTo(90, 2),
      );
    await request(app.getHttpServer())
      .get('/api/admin/analytics/export.csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect('Content-Type', /text\/csv/)
      .expect(200);
  });
});
