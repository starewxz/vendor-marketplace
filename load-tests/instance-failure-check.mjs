#!/usr/bin/env node
// Quick follow-up to multi-instance-realtime-check.mjs: after stopping
// backend-b, confirm the surviving instance (A) still serves new
// connections/REST and its own realtime pipeline still works standalone.
import { io } from 'socket.io-client';

const A = process.env.INSTANCE_A_URL ?? 'http://localhost:3000';
const B = process.env.INSTANCE_B_URL ?? 'http://localhost:3001';

async function main() {
  const health = await fetch(`${A}/api/health`);
  console.log(`instance A /api/health -> ${health.status} (expect 200)`);

  let bReachable = true;
  try {
    await fetch(`${B}/api/health`, { signal: AbortSignal.timeout(2000) });
  } catch {
    bReachable = false;
  }
  console.log(`instance B reachable -> ${bReachable} (expect false, stopped)`);

  const socket = await new Promise((resolve, reject) => {
    const s = io(A, { transports: ['websocket'], forceNew: true, reconnection: false });
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
  console.log('new socket connection to surviving instance A -> connected (expect true)');
  socket.disconnect();

  console.log(bReachable === false && health.status === 200 ? '\nPASS' : '\nFAIL');
}

main().catch((error) => {
  console.error('instance-failure check failed:', error);
  process.exitCode = 1;
});
