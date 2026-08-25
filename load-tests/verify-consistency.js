#!/usr/bin/env node
/**
 * Post-run consistency check for auction-bidding.js. The core "lost
 * updates = 0" invariant: the auction's currentPrice (shared mutable state,
 * written under the row lock) must equal the highest amount in the
 * append-only Bid history (independently persisted rows). If a concurrent
 * write had clobbered another, these two would diverge.
 *
 * Usage: BASE_URL=... node verify-consistency.js
 */
const fs = await import('node:fs');
const env = JSON.parse(
  fs.readFileSync(new URL('.load-test-env.json', import.meta.url), 'utf8'),
);
const BASE_URL = process.env.BASE_URL ?? env.baseUrl;
const AUCTION_ID = process.env.AUCTION_ID ?? env.auctionId;

async function main() {
  const auctionRes = await fetch(`${BASE_URL}/auctions/${AUCTION_ID}`);
  const auction = await auctionRes.json();

  const bidsRes = await fetch(`${BASE_URL}/auctions/${AUCTION_ID}/bids`);
  const bids = await bidsRes.json();

  const highestBidAmount = bids.reduce(
    (max, b) => Math.max(max, parseFloat(b.amount)),
    0,
  );
  const currentPrice = parseFloat(auction.currentPrice);

  console.log('=== consistency check ===');
  console.log(`auction status:        ${auction.status}`);
  console.log(`bid count (history):   ${bids.length}`);
  console.log(`highest bid (history): ${highestBidAmount.toFixed(2)}`);
  console.log(`auction currentPrice:  ${currentPrice.toFixed(2)}`);

  const consistent = Math.abs(highestBidAmount - currentPrice) < 0.005;
  console.log(
    consistent
      ? 'PASS: currentPrice matches the highest recorded bid — no lost update.'
      : 'FAIL: currentPrice does NOT match the highest recorded bid — possible lost update.',
  );
  process.exit(consistent ? 0 : 1);
}

main().catch((err) => {
  console.error('verify-consistency failed:', err);
  process.exit(1);
});
