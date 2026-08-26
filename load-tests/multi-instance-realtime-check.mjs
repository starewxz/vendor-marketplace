#!/usr/bin/env node
/**
 * Practical (not a benchmark) verification that the Socket.IO Redis adapter
 * genuinely propagates realtime events across two SEPARATE backend
 * processes, not just within one — and that private-room authorization
 * isn't weakened by going through a different instance than the one that
 * made the mutation.
 *
 * Requires two backend replicas sharing the same Postgres/Redis/
 * Meilisearch, and `socket.io-client` resolvable from this directory (it's
 * a backend devDependency, not duplicated here — one-time setup:
 * `ln -s ../backend/node_modules load-tests/node_modules`):
 *   docker compose -f docker-compose.yml -f docker-compose.multi-instance.yml up -d
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node load-tests/multi-instance-realtime-check.mjs
 *
 * See README "Realtime protocol" for the full result of the last run.
 */
import { randomUUID } from 'crypto';
import { io } from 'socket.io-client';

const A = process.env.INSTANCE_A_URL ?? 'http://localhost:3000';
const B = process.env.INSTANCE_B_URL ?? 'http://localhost:3001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme_admin_password';
const RUN_ID = Date.now().toString(36);

const stats = { connections: 0, eventsSent: 0, eventsReceived: 0, misses: 0, duplicates: 0 };

async function api(base, method, path, body, token, idempotent = false) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotent ? { 'Idempotency-Key': randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

function connect(base, token) {
  return new Promise((resolve, reject) => {
    const socket = io(base, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true, reconnection: false });
    socket.once('connect', () => { stats.connections += 1; resolve(socket); });
    socket.once('connect_error', reject);
  });
}

function subscribe(socket, event, id) {
  return new Promise((resolve) => socket.emit(event, { id }, resolve));
}

function waitForEvent(socket, event, predicate, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off(event, listener); reject(new Error(`timed out waiting for ${event}`)); }, timeoutMs);
    const listener = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timeout);
      socket.off(event, listener);
      stats.eventsReceived += 1;
      resolve(payload);
    };
    socket.on(event, listener);
  });
}

async function main() {
  console.log(`[setup] A=${A} B=${B} runId=${RUN_ID}`);

  const admin = await api(A, 'POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const adminToken = admin.accessToken;

  async function registerCustomer(label) {
    const email = `mi-${label}-${RUN_ID}@example.com`;
    const res = await api(A, 'POST', '/auth/register', { email, password: 'MultiInstance123!', firstName: 'MI', lastName: label });
    return { email, token: res.accessToken, id: res.user.id };
  }

  const seller = await registerCustomer('seller');
  await api(A, 'POST', '/seller-applications', { businessName: `MI Seller ${RUN_ID}`, description: 'Multi-instance realtime verification storefront.' }, seller.token);
  const apps = await api(A, 'GET', '/seller-applications/me', undefined, seller.token);
  await api(A, 'PATCH', `/admin/seller-applications/${apps[0].id}/approve`, undefined, adminToken);
  const sellerRelogin = await api(A, 'POST', '/auth/login', { email: seller.email, password: 'MultiInstance123!' });
  const sellerToken = sellerRelogin.accessToken;

  const category = await api(A, 'POST', '/admin/categories', { name: `MI Category ${RUN_ID}` }, adminToken);

  const customerA = await registerCustomer('customer-a');
  const customerB = await registerCustomer('customer-b');

  // --- 1. Cross-instance PRODUCT STOCK propagation ---
  const product = await api(A, 'POST', '/seller/products', {
    name: `MI Stock Product ${RUN_ID}`, categoryId: category.id, type: 'FIXED_PRICE', price: '15.00', stockQuantity: 3,
  }, sellerToken);

  const stockWatcher = await connect(B, undefined); // connect to instance B, mutation happens via instance A
  const stockSub = await subscribe(stockWatcher, 'subscribe:product', product.id);
  console.log(`[1] subscribed to product room on instance B: ok=${stockSub.ok}`);
  const stockWait = waitForEvent(stockWatcher, 'product.stock.updated', (p) => p.productId === product.id);

  await api(A, 'POST', '/cart/items', { productId: product.id, quantity: 1 }, customerA.token);
  stats.eventsSent += 1;
  await api(A, 'POST', '/cart/checkout', {}, customerA.token, true);
  try {
    const stockEvent = await stockWait;
    console.log(`[1] PASS product.stock.updated received cross-instance (A mutated -> B delivered): stock=${stockEvent.stock}`);
  } catch (error) {
    stats.misses += 1;
    console.error(`[1] FAIL ${error.message}`);
  }
  stockWatcher.disconnect();

  // --- 2. Cross-instance AUCTION BID propagation ---
  const auctionProduct = await api(A, 'POST', '/seller/products', {
    name: `MI Auction Product ${RUN_ID}`, categoryId: category.id, type: 'AUCTION', price: '100.00', stockQuantity: 1,
  }, sellerToken);
  const auction = await api(A, 'POST', '/seller/auctions', {
    productId: auctionProduct.id, startPrice: '50.00', minBidIncrement: '5.00',
    startsAt: new Date(Date.now() - 5_000).toISOString(), endsAt: new Date(Date.now() + 120_000).toISOString(),
  }, sellerToken);

  const bidWatcher = await connect(A, customerB.token); // connect to instance A
  const bidSub = await subscribe(bidWatcher, 'subscribe:auction', auction.id);
  console.log(`[2] subscribed to auction room on instance A: ok=${bidSub.ok}`);
  const bidWait = waitForEvent(bidWatcher, 'auction.bid.updated', (p) => p.auctionId === auction.id);

  await api(B, 'POST', `/auctions/${auction.id}/bids`, { amount: '55.00' }, customerA.token, true); // bid placed via instance B
  stats.eventsSent += 1;
  try {
    const bidEvent = await bidWait;
    console.log(`[2] PASS auction.bid.updated received cross-instance (B mutated -> A delivered): currentPrice=${bidEvent.currentPrice}`);
  } catch (error) {
    stats.misses += 1;
    console.error(`[2] FAIL ${error.message}`);
  }
  bidWatcher.disconnect();

  // --- 3. Private room authorization is not weakened across instances ---
  const cartCustomerA = await api(A, 'GET', '/orders', undefined, customerA.token);
  const orderId = cartCustomerA.items[0].id;

  const ownerSocket = await connect(A, customerA.token);
  const ownerSub = await subscribe(ownerSocket, 'subscribe:order', orderId);
  console.log(`[3] owner (customer A) subscribe:order via instance A -> ok=${ownerSub.ok} (expect true)`);

  const strangerSocket = await connect(B, customerB.token); // different customer, different instance
  const strangerSub = await subscribe(strangerSocket, 'subscribe:order', orderId);
  console.log(`[3] stranger (customer B) subscribe:order via instance B -> ok=${strangerSub.ok} (expect false)`);
  if (ownerSub.ok && !strangerSub.ok) {
    console.log('[3] PASS private-room authorization correctly enforced across instances');
  } else {
    console.error('[3] FAIL private-room authorization did not behave as expected');
  }
  ownerSocket.disconnect();
  strangerSocket.disconnect();

  console.log('\n=== multi-instance realtime check summary ===');
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error('multi-instance check failed:', error);
  process.exitCode = 1;
});
