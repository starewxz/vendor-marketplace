# Load tests

Concurrent auction bidding load test (spec Phase 4). Validates the
pessimistic-locking concurrency control in `BidPlacementService.placeBid`
under real concurrent HTTP load — the invariant under test is **no lost
updates**: the auction's `currentPrice` must always equal the highest bid
actually persisted, even when many bidders race for the same auction.

## Prerequisites

- The stack is running: `docker compose up -d`
- An admin account is seeded: `npm run seed:admin` (inside `backend/`)
- Node 20+ (for the setup/verify scripts) and [k6](https://k6.io) installed

## 1. Set up a fresh auction + bidder pool

```bash
cd load-tests
BASE_URL=http://localhost:3000/api BIDDER_COUNT=25 node setup-auction.js
```

Creates an approved seller, an AUCTION product, opens the auction, registers
`BIDDER_COUNT` bidder accounts, and writes everything (auction id + bidder
access tokens) to `.load-test-env.json` (gitignored — contains live tokens).

Registration is throttled server-side (10/min per IP), so this takes a few
minutes for larger bidder pools — that's expected.

## 2. Run the load test

```bash
k6 run auction-bidding.js
```

This runs against the **real, unmodified backend configuration** — no rate
limits are changed. It's a single burst: `VUS` virtual users (default 50,
override with `VUS=100 k6 run auction-bidding.js`) each fire exactly one bid
request as close to simultaneously as k6 can schedule. Since bid placement
is throttled to 20 requests/10s per IP in production, most of a 50-VU burst
from one machine will be correctly rejected with `429` — that's the rate
limiter working as intended under a traffic spike, not a test failure.
`429`s are counted separately from `409` conflicts.

To collect a larger sample, run the script multiple times ~11 seconds apart
(just past the throttle window) against the same auction — each run's
`setup()` step refreshes the base price from the server first, so
back-to-back bursts still produce some validly-increasing bids instead of
all falling below an already-higher price:

```bash
for i in 1 2 3; do k6 run auction-bidding.js; sleep 11; done
```

Results are written to `load-test-result.json` (gitignored raw k6 output,
overwritten each run).

## 3. Verify final consistency

```bash
node verify-consistency.js
```

Confirms the auction's `currentPrice` equals the highest bid amount actually
recorded in the (independently persisted, append-only) bid history — the
concrete "lost updates = 0" check.

See `docs/load-test-report.md` for the last executed run's results, and for
a note on a real throttling bug that was found and fixed while calibrating
this test.
