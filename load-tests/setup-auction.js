#!/usr/bin/env node
/**
 * One-time setup for the concurrent-auction-bidding load test.
 *
 * Creates a seller, gets it admin-approved, publishes one AUCTION product,
 * opens an auction on it, registers a pool of bidder accounts, and writes
 * their access tokens + the auction id to load-tests/.load-test-env.json —
 * which auction-bidding.js reads at k6 startup.
 *
 * Requires the app stack already running (docker compose up) and an admin
 * account seeded (npm run seed:admin — ADMIN_EMAIL/ADMIN_PASSWORD from .env).
 *
 * Usage: BASE_URL=http://localhost:3000/api BIDDER_COUNT=25 node setup-auction.js
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme_admin_password';
const BIDDER_COUNT = parseInt(process.env.BIDDER_COUNT ?? '25', 10);
const AUCTION_DURATION_MINUTES = parseInt(
  process.env.AUCTION_DURATION_MINUTES ?? '30',
  10,
);
const RUN_ID = Date.now().toString(36);

async function api(method, path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(
      `${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`,
    );
  }
  return json;
}

async function registerAndLogin(email, password, firstName, lastName) {
  try {
    const { accessToken } = await api('POST', '/auth/register', {
      email,
      password,
      firstName,
      lastName,
    });
    return accessToken;
  } catch (err) {
    if (!String(err).includes('409')) throw err;
    const { accessToken } = await api('POST', '/auth/login', {
      email,
      password,
    });
    return accessToken;
  }
}

// Registration is throttled to 10/min per IP — space calls out so a large
// bidder pool doesn't 429 during setup (setup correctness matters more than
// setup speed; the load test itself runs after this completes).
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log(`[setup] BASE_URL=${BASE_URL} BIDDER_COUNT=${BIDDER_COUNT}`);

  console.log('[setup] logging in as admin...');
  const adminToken = await (async () => {
    const { accessToken } = await api('POST', '/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    return accessToken;
  })();

  console.log('[setup] creating seller account...');
  const sellerPassword = 'LoadTestSeller1!';
  const sellerToken = await registerAndLogin(
    `loadtest-seller-${RUN_ID}@example.com`,
    sellerPassword,
    'Load',
    'Seller',
  );

  console.log('[setup] applying for seller status...');
  const application = await api(
    'POST',
    '/seller-applications',
    {
      businessName: `Load Test Auctions ${RUN_ID}`,
      description:
        'Seller account created by load-tests/setup-auction.js for concurrent auction bidding load tests.',
    },
    sellerToken,
  );

  console.log('[setup] approving seller application as admin...');
  await api(
    'PATCH',
    `/admin/seller-applications/${application.id}/approve`,
    undefined,
    adminToken,
  );

  // Re-login: the JWT issued before approval still carries role=CUSTOMER.
  const approvedSellerToken = await (async () => {
    const { accessToken } = await api('POST', '/auth/login', {
      email: `loadtest-seller-${RUN_ID}@example.com`,
      password: sellerPassword,
    });
    return accessToken;
  })();

  console.log('[setup] creating category...');
  const category = await api(
    'POST',
    '/admin/categories',
    { name: `Load Test ${RUN_ID}` },
    adminToken,
  );

  console.log('[setup] creating AUCTION product...');
  const product = await api(
    'POST',
    '/seller/products',
    {
      name: `Load Test Item ${RUN_ID}`,
      description: 'Auction product created for a k6 concurrency load test.',
      categoryId: category.id,
      type: 'AUCTION',
      stockQuantity: 1,
      isPublished: true,
    },
    approvedSellerToken,
  );

  console.log('[setup] creating auction...');
  const startsAt = new Date(Date.now() - 5_000).toISOString();
  const endsAt = new Date(
    Date.now() + AUCTION_DURATION_MINUTES * 60_000,
  ).toISOString();
  const auction = await api(
    'POST',
    '/seller/auctions',
    {
      productId: product.id,
      startPrice: '10.00',
      minBidIncrement: '1.00',
      startsAt,
      endsAt,
    },
    approvedSellerToken,
  );

  console.log(`[setup] auction created: ${auction.id} (ends ${endsAt})`);

  console.log(`[setup] registering ${BIDDER_COUNT} bidder accounts...`);
  const bidderTokens = [];
  for (let i = 0; i < BIDDER_COUNT; i += 1) {
    const token = await registerAndLogin(
      `loadtest-bidder-${RUN_ID}-${i}@example.com`,
      'LoadTestBidder1!',
      'Load',
      `Bidder${i}`,
    );
    bidderTokens.push(token);
    process.stdout.write(`\r[setup] registered ${i + 1}/${BIDDER_COUNT}`);
    // Registration is throttled to 10/min per IP (see auth.controller.ts).
    if ((i + 1) % 9 === 0) await sleep(61_000);
  }
  console.log();

  const output = {
    baseUrl: BASE_URL,
    auctionId: auction.id,
    startPrice: auction.startPrice,
    minBidIncrement: auction.minBidIncrement,
    endsAt,
    bidderTokens,
  };
  const fs = await import('node:fs');
  fs.writeFileSync(
    new URL('.load-test-env.json', import.meta.url),
    JSON.stringify(output, null, 2),
  );
  console.log(
    `[setup] done. Wrote load-tests/.load-test-env.json (auctionId=${auction.id}, ${bidderTokens.length} bidders).`,
  );
}

main().catch((err) => {
  console.error('[setup] failed:', err);
  process.exit(1);
});
