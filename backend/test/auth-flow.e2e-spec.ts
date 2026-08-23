/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- supertest's res.body is untyped */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/modules/users/users.service';
import { UserRole } from '../src/modules/users/entities/user-role.enum';

/**
 * Requires live Postgres/Redis/Meilisearch (e.g. `docker compose up`), and
 * that migrations have been run. Exercises the full Stage 2 flow end to
 * end: register -> login -> me -> RBAC -> seller application -> admin
 * moderation -> seller access granted -> refresh rotation/reuse -> logout.
 *
 * Not run by the base CI job (see README "CI") since it needs those live
 * services; run manually with `npm run test:e2e`.
 */
describe('Auth + seller moderation flow (e2e)', () => {
  let app: INestApplication<App>;
  let usersService: UsersService;
  const runId = randomUUID().slice(0, 8);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    // Mirrors main.ts's bootstrap() — e2e tests build the app directly and
    // skip bootstrap(), so anything registered there (cookie-parser for the
    // refresh-token cookie) has to be replicated here.
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    usersService = moduleFixture.get(UsersService);
  });

  afterAll(async () => {
    await app.close();
  });

  const customerEmail = `customer-${runId}@example.com`;
  const adminEmail = `admin-${runId}@example.com`;
  const password = 'Str0ngPassword!';

  let customerAccessToken: string;
  let customerId: string;
  let applicationId: string;
  let adminAccessToken: string;

  it('registers a new CUSTOMER account', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: customerEmail,
        password,
        firstName: 'Casey',
        lastName: 'Customer',
      })
      .expect(201);

    expect(res.body.user.role).toBe('CUSTOMER');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();

    customerAccessToken = res.body.accessToken;
    customerId = res.body.user.id;
  });

  it('rejects a duplicate registration with 409', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: customerEmail,
        password,
        firstName: 'Casey',
        lastName: 'Customer',
      })
      .expect(409);
  });

  it('rejects login with wrong password with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: customerEmail, password: 'wrong-password' })
      .expect(401);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: customerEmail, password })
      .expect(200);

    expect(res.body.user.email).toBe(customerEmail);
    customerAccessToken = res.body.accessToken;
  });

  it('GET /users/me works with a valid access token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .expect(200);

    expect(res.body.id).toBe(customerId);
    expect(res.body.role).toBe('CUSTOMER');
  });

  it('rejects unauthenticated access with 401', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);
  });

  it('a CUSTOMER cannot access an Admin-only route (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/seller-applications')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .expect(403);
  });

  it('submits a seller application', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/seller-applications')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .send({
        businessName: `Casey's Shop ${runId}`,
        description: 'A shop selling hand-made goods for testing.',
      })
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    applicationId = res.body.id;
  });

  it('rejects a second PENDING application from the same user (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/seller-applications')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .send({
        businessName: 'Another shop',
        description: 'Trying to apply again while pending.',
      })
      .expect(409);
  });

  it("lists the applicant's own applications", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/seller-applications/me')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(applicationId);
  });

  it('promotes a second user to ADMIN for moderation (test fixture setup, not an HTTP flow)', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: adminEmail,
        password,
        firstName: 'Alex',
        lastName: 'Admin',
      })
      .expect(201);

    await usersService.setRole(registerRes.body.user.id, UserRole.ADMIN);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);

    expect(loginRes.body.user.role).toBe('ADMIN');
    adminAccessToken = loginRes.body.accessToken;
  });

  it('Admin sees the pending application', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/seller-applications?status=PENDING')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(
      res.body.some((app: { id: string }) => app.id === applicationId),
    ).toBe(true);
  });

  it('Admin approves the application', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/admin/seller-applications/${applicationId}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(res.body.status).toBe('APPROVED');
  });

  it('a repeated approval on the same application is rejected (409), not duplicated', async () => {
    await request(app.getHttpServer())
      .patch(`/api/admin/seller-applications/${applicationId}/approve`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(409);
  });

  it('the customer now has SELLER access after re-authenticating', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: customerEmail, password })
      .expect(200);

    expect(res.body.user.role).toBe('SELLER');
  });

  describe('reject flow', () => {
    const rejectedEmail = `rejected-${runId}@example.com`;
    let rejectedApplicantToken: string;
    let rejectedApplicationId: string;

    it('a different customer applies and gets rejected with a reason', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: rejectedEmail,
          password,
          firstName: 'Robin',
          lastName: 'Reject',
        })
        .expect(201);
      rejectedApplicantToken = registerRes.body.accessToken;

      const applyRes = await request(app.getHttpServer())
        .post('/api/seller-applications')
        .set('Authorization', `Bearer ${rejectedApplicantToken}`)
        .send({
          businessName: 'Sketchy Shop',
          description: 'Not enough detail provided here at all really.',
        })
        .expect(201);
      rejectedApplicationId = applyRes.body.id;

      const rejectRes = await request(app.getHttpServer())
        .patch(`/api/admin/seller-applications/${rejectedApplicationId}/reject`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ reason: 'Business description was too vague.' })
        .expect(200);

      expect(rejectRes.body.status).toBe('REJECTED');
      expect(rejectRes.body.rejectionReason).toBe(
        'Business description was too vague.',
      );
    });

    it('the rejected applicant remains a CUSTOMER', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${rejectedApplicantToken}`)
        .expect(200);

      expect(res.body.role).toBe('CUSTOMER');
    });
  });

  describe('refresh token rotation, reuse detection, and logout', () => {
    const sessionEmail = `session-${runId}@example.com`;

    it('rotates the refresh token on /auth/refresh and rejects reuse of the old one', async () => {
      const agent = request.agent(app.getHttpServer());

      const registerRes = await agent
        .post('/api/auth/register')
        .send({
          email: sessionEmail,
          password,
          firstName: 'Sam',
          lastName: 'Session',
        })
        .expect(201);
      const originalCookie = registerRes.headers['set-cookie'];

      // Normal rotation via the agent's cookie jar succeeds.
      await agent.post('/api/auth/refresh').expect(200);

      // Replaying the pre-rotation cookie must fail — it was revoked.
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', originalCookie)
        .expect(401);
    });

    it('rejects /auth/refresh with no cookie at all', async () => {
      await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
    });

    it('logout revokes the session so refresh no longer works', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/auth/register')
        .send({
          email: `logout-${runId}@example.com`,
          password,
          firstName: 'Lee',
          lastName: 'Logout',
        })
        .expect(201);

      await agent.post('/api/auth/logout').expect(204);
      await agent.post('/api/auth/refresh').expect(401);
    });
  });
});
