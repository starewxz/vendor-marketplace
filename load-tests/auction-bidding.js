// Concurrent auction bidding load test (spec Phase 4 / #50-52).
//
// Validates the pessimistic-locking concurrency control in
// BidPlacementService.placeBid: many virtual users hit the SAME auction at
// the same instant — a "closing rally" burst — with a mix of valid
// (correctly-incrementing) and invalid (stale/too-low) bid amounts. The
// row lock inside placeBid must serialize every write regardless. The
// critical invariant is "no lost updates": the server's final currentPrice
// must equal the highest bid amount actually persisted — checked
// separately by verify-consistency.js against independent state (the
// append-only bid history), not by the VUs themselves.
//
// Runs against the REAL, unmodified production configuration — including
// the bid-placement throttle (20 requests/10s per IP, hardcoded in
// bidding.controller.ts). A burst of 50 VUs racing one auction from a
// single test-runner IP will legitimately trip that throttle for most of
// the burst; 429s are counted separately from 409 conflicts and are not
// treated as failures — throttling under a traffic spike is itself
// correct, intended behavior, not a bug this test is checking for.
//
// Setup: run `node setup-auction.js` first (see load-tests/README.md) — it
// writes .load-test-env.json with an auctionId and a pool of bidder tokens.
//
// Usage:
//   BASE_URL=http://localhost:3000/api k6 run auction-bidding.js
//   k6 run --vus 100 auction-bidding.js   (override VU count)

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const env = JSON.parse(open('./.load-test-env.json'));
const BASE_URL = __ENV.BASE_URL || env.baseUrl || 'http://localhost:3000/api';
const AUCTION_ID = __ENV.AUCTION_ID || env.auctionId;
const START_PRICE = parseFloat(env.startPrice);
const MIN_INCREMENT = parseFloat(env.minBidIncrement);

const acceptedBids = new Counter('bids_accepted');
const rejectedConflict = new Counter('bids_rejected_conflict'); // 409
const rejectedThrottled = new Counter('bids_rejected_throttled'); // 429
const unexpectedFailures = new Counter('bids_unexpected_failures');
const bidDuration = new Trend('bid_request_duration', true);

const VUS = parseInt(__ENV.VUS ?? '50', 10);

export const options = {
  scenarios: {
    closing_rally_burst: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1, // every VU fires exactly once, as close to simultaneous as k6 can schedule
      maxDuration: '30s',
    },
  },
  thresholds: {
    // The correctness assertion lives in verify-consistency.js (final
    // auction state vs. independent bid history), not here — this just
    // catches infrastructure-level failures (crashes, malformed
    // responses), distinct from expected conflict/throttle rejections.
    bids_unexpected_failures: ['count==0'],
  },
};

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// One GET, once per k6 invocation (not per VU) — cheap enough to stay well
// under the unrelated general API throttle — so repeated bursts against
// the same auction bid up from its *current* price rather than a fixed
// constant baseline that's immediately stale after the first accepted bid.
export function setup() {
  const res = http.get(`${BASE_URL}/auctions/${AUCTION_ID}`);
  const basePrice = res.status === 200 ? parseFloat(res.json('currentPrice')) : START_PRICE;
  return { basePrice };
}

export default function (data) {
  const token = env.bidderTokens[__VU % env.bidderTokens.length];
  const headers = authHeaders(token);
  const basePrice = data.basePrice;

  // Every VU independently picks an amount near this burst's known
  // starting price — deliberately not synced with each other beyond that
  // one shared baseline, simulating bidders racing to be the one whose bid
  // lands. 25% deliberately underbid.
  const bidLow = Math.random() < 0.25;
  const amount = bidLow
    ? Math.max(0, basePrice - MIN_INCREMENT / 2).toFixed(2) // expect 409
    : (basePrice + MIN_INCREMENT + Math.round(Math.random() * 2000) / 100).toFixed(2);

  const idempotencyKey = `${__VU}-${__ITER}-${Date.now()}`;
  const res = http.post(
    `${BASE_URL}/auctions/${AUCTION_ID}/bids`,
    JSON.stringify({ amount }),
    {
      headers: { ...headers, 'Idempotency-Key': idempotencyKey },
    },
  );
  bidDuration.add(res.timings.duration);

  if (res.status === 201) {
    acceptedBids.add(1);
    check(res, { 'accepted bid returns bidId': (r) => !!r.json('bidId') });
  } else if (res.status === 409) {
    rejectedConflict.add(1);
  } else if (res.status === 429) {
    rejectedThrottled.add(1);
  } else {
    unexpectedFailures.add(1);
    console.error(`unexpected bid response ${res.status}: ${res.body}`);
  }
}

export function handleSummary(data) {
  const summary = {
    accepted: data.metrics.bids_accepted?.values.count ?? 0,
    rejectedConflict: data.metrics.bids_rejected_conflict?.values.count ?? 0,
    rejectedThrottled: data.metrics.bids_rejected_throttled?.values.count ?? 0,
    unexpectedFailures: data.metrics.bids_unexpected_failures?.values.count ?? 0,
    httpReqDuration: data.metrics.http_req_duration?.values,
    iterations: data.metrics.iterations?.values.count,
  };
  console.log('\n=== auction-bidding load test summary ===');
  console.log(JSON.stringify(summary, null, 2));
  return {
    stdout: '',
    './load-test-result.json': JSON.stringify(data, null, 2),
  };
}
