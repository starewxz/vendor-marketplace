#!/usr/bin/env node
/**
 * Verifies Socket.IO realtime delivery works correctly through the
 * Kubernetes `backend` Service with 2 replicas — not by inspecting
 * architecture, by actually driving a real mutation and checking a
 * connected client receives the resulting event. See README "Kubernetes
 * deployment" for the last recorded result and how this differs from
 * `multi-instance-realtime-check.mjs` (that one uses two separate host
 * ports/containers; this one uses a single K8s Service in front of both
 * replicas, which is the actual K8s topology).
 *
 * Requires: cluster deployed (see README), seed-admin Job already run,
 * and `kubectl port-forward -n marketplace svc/frontend 8080:80` running.
 *
 * Usage: BASE_URL=http://localhost:8080 node load-tests/k8s-realtime-check.mjs
 */
import { randomUUID } from 'crypto';
import { io } from 'socket.io-client';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme_admin_password';
const TS = Date.now();

async function api(method, path, body, token, idempotent = false) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotent ? { 'Idempotency-Key': randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  const admin = await api('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const seller = await api('POST', '/auth/register', { email: `k8s-seller-${TS}@example.com`, password: 'K8sTest123!', firstName: 'K8s', lastName: 'Seller' });
  await api('POST', '/seller-applications', { businessName: `K8s Seller ${TS}`, description: 'Kubernetes multi-replica realtime verification storefront.' }, seller.accessToken);
  const apps = await api('GET', '/seller-applications/me', undefined, seller.accessToken);
  await api('PATCH', `/admin/seller-applications/${apps[0].id}/approve`, undefined, admin.accessToken);
  const sellerRelogin = await api('POST', '/auth/login', { email: `k8s-seller-${TS}@example.com`, password: 'K8sTest123!' });
  const category = await api('POST', '/admin/categories', { name: `K8s Category ${TS}` }, admin.accessToken);
  const product = await api('POST', '/seller/products', { name: `K8s Stock Product ${TS}`, categoryId: category.id, type: 'FIXED_PRICE', price: '10.00', stockQuantity: 5 }, sellerRelogin.accessToken);
  const customer = await api('POST', '/auth/register', { email: `k8s-customer-${TS}@example.com`, password: 'K8sTest123!', firstName: 'K8s', lastName: 'Customer' });

  const socket = await new Promise((resolve, reject) => {
    const s = io(BASE, { transports: ['websocket'], forceNew: true, reconnection: false });
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
  console.log(`socket connected: id=${socket.id}`);

  const sub = await new Promise((resolve) => socket.emit('subscribe:product', { id: product.id }, resolve));
  console.log(`subscribed to product room: ok=${sub.ok}`);

  const eventPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timed out waiting for product.stock.updated')), 10000);
    socket.once('product.stock.updated', (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });

  await api('POST', '/cart/items', { productId: product.id, quantity: 1 }, customer.accessToken);
  await api('POST', '/cart/checkout', {}, customer.accessToken, true);

  try {
    const event = await eventPromise;
    console.log(`PASS: product.stock.updated received through the K8s Service across 2 backend replicas: stock=${event.stock}`);
  } catch (err) {
    console.error(`FAIL: ${err.message}`);
    process.exitCode = 1;
  } finally {
    socket.disconnect();
  }
}

main().catch((err) => {
  console.error('k8s realtime check failed:', err);
  process.exitCode = 1;
});
