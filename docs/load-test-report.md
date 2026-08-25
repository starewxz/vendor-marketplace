# Load Test Report — Concurrent Auction Bidding

## Scenario

Per spec Phase 4, the preferred scenario — concurrent bidding against a single auction — was chosen because it
directly validates the Stage 6 concurrency-safety claim: `BidPlacementService.placeBid` uses a pessimistic row lock
(`SELECT ... FOR UPDATE`) on the `Auction` row, with the deadline/minimum-bid validation re-evaluated *inside* the
lock, so concurrent writers must serialize. This test exercises that lock under real concurrent HTTP traffic, not
unit-test mocks — and does so against the backend's **real, unmodified production configuration**, including its
bid-placement rate limit.

Tooling: [k6](https://k6.io) v2.2.0. Scripts: `load-tests/setup-auction.js` (fixture setup),
`load-tests/auction-bidding.js` (load scenario), `load-tests/verify-consistency.js` (post-run correctness check).

## Environment

- Local Docker Compose stack (`docker compose up -d`): Postgres 16, Redis 7, Meilisearch v1.10, backend (Node 20,
  built from the current code, no configuration overrides).
- Backend reachable at `http://localhost:3000/api`.
- Auction: 1 seller, 1 AUCTION product, `startPrice=10.00`, `minBidIncrement=1.00`, 30-minute bidding window.
- 25 distinct bidder accounts (JWT access tokens), each shared across two k6 VUs (50 VUs total, `__VU % 25`
  assignment).

## Configuration

- k6 scenario: `per-vu-iterations`, 50 VUs, 1 iteration each — every VU fires its one bid request as close to
  simultaneously as k6 can schedule (a "closing rally" burst, not a sustained ramp). `setup()` does one GET to seed
  each burst's bid amounts from the auction's live price, so a burst run right after a previous one still produces
  some validly-increasing bids rather than all falling below the now-higher price.
- Each VU submits a bid — 25% of the time deliberately below the required minimum (expects `409`), otherwise
  above the burst's known starting price with random jitter (so concurrent VUs target different amounts).
- **No throttle configuration was changed for this run.** Bid placement is governed by its real, fixed, hardcoded
  limit (`@Throttle({ default: { limit: 20, ttl: 10_000 } })` in `bidding.controller.ts`) — 20 requests/10s per IP,
  the same limit that applies in production. Since 50 VUs firing at once from a single test-runner IP is far above
  that budget, most of the burst is correctly throttled (`429`) — this is the rate limiter doing its job under a
  traffic spike, not a test failure. `429`s are counted in a separate metric from `409` conflicts and are not
  treated as errors.
- To collect a larger sample without editing any configuration, **7 bursts were run**, spaced 11 seconds apart
  (just past the throttle's 10-second window) so each burst gets its own fresh throttle budget, all against the
  same auction.

## An important bug found and fixed during development of this test

While first calibrating this test, the bid-placement throttle was made env-configurable by registering a second
named throttler (`bid`) in `ThrottlerModule`. This introduced a real bug: `@nestjs/throttler` applies **every**
registered named throttler to **every** route by default, not just the route it was written for. The second
throttler ended up rate-limiting unrelated endpoints (`GET /products`, `GET /seller/orders`, ...) at 20 requests/10s
— confirmed by full e2e suite failures (`retry-after-bid` headers appearing on non-bid routes) and would have been a
real production regression. It was reverted before this run: bid placement is back to a single hardcoded
`@Throttle()` override on the `default` throttler, scoped correctly to just that one route, matching the original
pre-audit design. The full e2e suite (96/96) passes cleanly with this fix in place. This is the version of the code
this load test was run against.

## Results (actual, 7 bursts of 50 VUs each, same auction)

```
scenario per burst:    50 VUs, 1 request each, fired as a single burst
bursts run:             7 (11s apart)
total bid requests:    350  (50 × 7)

bids accepted:          10
bids rejected (409):   130   (correctly-rejected: underbid amounts, or lost the race to a lower-priced
                               request that landed first within the same burst)
bids rejected (429):   210   (correctly throttled: burst volume exceeds the 20/10s per-IP budget by design)
unexpected failures:     0

http_req_duration (representative burst):
  min:      12–18 ms
  median:  130–320 ms
  p90:     195–444 ms
  p95:     200–456 ms
  max:     209–467 ms
```

Latency rises somewhat across successive bursts (median ~130ms in early bursts, ~320ms by the last) — consistent
with 50 near-simultaneous requests contending for one row lock: requests queue briefly behind whichever holds the
lock first, rather than failing.

### Consistency check (`verify-consistency.js`, after all 7 bursts)

```
auction status:        ACTIVE
bid count (history):   10
highest bid (history): 89.42
auction currentPrice:  89.42
PASS: currentPrice matches the highest recorded bid — no lost update.
```

The auction's `currentPrice` (shared mutable state, written under the row lock) exactly equals the highest amount
among all 10 independently persisted `Bid` rows (the append-only history) across all 7 bursts combined. If the
pessimistic lock had failed to serialize concurrent writers, a lost update would show up here as a mismatch — a
lower `currentPrice` than the true highest bid, or a bid count inconsistent with the accepted-response count.
Neither occurred, across 350 total concurrent requests.

## Interpretation

- **Lost updates: 0.** The core invariant under test holds under real concurrent load, including load that
  substantially exceeds the configured rate limit.
- The 429/409 rejection counts are expected, correct behavior, not test failures: within a single 50-VU burst, only
  ~20 requests get past the throttle at all (by design — that limit exists specifically to bound abuse/spam), and of
  those, only the request(s) whose amount is still valid by the time the lock admits them are accepted; the rest are
  legitimately outbid or throttled.
- Zero unexpected failures (5xx, malformed responses, crashes) across 350 requests — the bidding path held up
  structurally under concurrent load, including sustained lock contention within each burst.
- Running against the real, unmodified rate limit (rather than raising it for the test) is itself a meaningful
  result: it demonstrates the throttle and the row-lock concurrency control compose correctly — the throttle sheds
  excess load, and everything that gets through is still handled with full correctness.

## Known limitations

- Single local Docker Compose environment on one machine — not a distributed/multi-instance backend deployment, and
  not representative of real network latency between client and server.
- Because the test intentionally runs against the real per-IP throttle, most of each burst is rejected before ever
  reaching the bid-placement logic under test; only ~20 requests per burst exercise the row lock directly. A
  distributed load-testing rig (many source IPs) would let a full 50-VU burst reach the lock simultaneously without
  needing repeated smaller bursts.
- p99 latency was not collected (k6 default summary trend stats only include p90/p95).
- Accepted-bid count is modest (10 across 350 requests) precisely because of the above — this test optimizes for
  "use the real, unmodified system correctly" over "maximize accepted-bid volume."
