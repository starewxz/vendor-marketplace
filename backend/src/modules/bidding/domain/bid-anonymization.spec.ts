import { Bid } from '../entities/bid.entity';
import { anonymizeBidHistory } from './bid-anonymization';

function bidFixture(overrides: Partial<Bid> = {}): Bid {
  return {
    id: 'bid-1',
    auctionId: 'auction-1',
    bidderId: 'bidder-1',
    amount: '10.00',
    idempotencyKey: 'key-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as Bid;
}

describe('anonymizeBidHistory', () => {
  it('assigns stable labels by first-appearance order, never the real bidderId', () => {
    const bids = [
      bidFixture({ id: 'bid-1', bidderId: 'alice', amount: '10.00' }),
      bidFixture({ id: 'bid-2', bidderId: 'bob', amount: '11.00' }),
      bidFixture({ id: 'bid-3', bidderId: 'alice', amount: '12.00' }),
    ];

    const result = anonymizeBidHistory(bids, undefined);

    expect(result.map((r) => r.bidderLabel)).toEqual([
      'Bidder 1',
      'Bidder 2',
      'Bidder 1',
    ]);
    expect(result.every((r) => !JSON.stringify(r).includes('alice'))).toBe(
      true,
    );
    expect(result.every((r) => !JSON.stringify(r).includes('bob'))).toBe(true);
  });

  it("marks isMine only for the current user's own bids", () => {
    const bids = [
      bidFixture({ id: 'bid-1', bidderId: 'alice' }),
      bidFixture({ id: 'bid-2', bidderId: 'bob' }),
    ];

    const result = anonymizeBidHistory(bids, 'bob');

    expect(result[0].isMine).toBe(false);
    expect(result[1].isMine).toBe(true);
  });

  it('never marks isMine true for an unauthenticated caller', () => {
    const bids = [bidFixture({ bidderId: 'alice' })];
    const result = anonymizeBidHistory(bids, undefined);
    expect(result[0].isMine).toBe(false);
  });
});
