import { ConflictException } from '@nestjs/common';
import { AuctionStatus } from '../entities/auction-status.enum';

/**
 * Single source of truth for Auction status transitions — mirrors
 * orders/domain/seller-order-status.policy.ts. SCHEDULED/ACTIVE are
 * self-healed from startsAt/endsAt at the point of use (see
 * BidPlacementService) rather than driven by a separate "start" job, so the
 * only forward-driving transitions modeled here are the ones triggered by
 * finalization, purchase, expiry, and cancellation.
 *
 * UNSOLD and EXPIRED deliberately distinguish no-bid finalization from a
 * winner who missed the payment window. ENDED remains a legacy terminal
 * value for compatibility with the Stage 1 schema but Stage 6 no longer
 * writes it.
 */
const FORWARD_TRANSITIONS: Record<AuctionStatus, AuctionStatus[]> = {
  [AuctionStatus.SCHEDULED]: [AuctionStatus.ACTIVE, AuctionStatus.CANCELLED],
  [AuctionStatus.ACTIVE]: [
    AuctionStatus.UNSOLD,
    AuctionStatus.AWAITING_PAYMENT,
    AuctionStatus.CANCELLED,
  ],
  [AuctionStatus.AWAITING_PAYMENT]: [
    AuctionStatus.COMPLETED,
    AuctionStatus.EXPIRED,
  ],
  [AuctionStatus.ENDED]: [],
  [AuctionStatus.UNSOLD]: [],
  [AuctionStatus.EXPIRED]: [],
  [AuctionStatus.COMPLETED]: [],
  [AuctionStatus.CANCELLED]: [],
};

/** States a seller/admin can cancel an auction from — once a winner has
 * been determined (AWAITING_PAYMENT) the purchase-window flow owns the
 * outcome instead. */
const CANCELLABLE_FROM: readonly AuctionStatus[] = [
  AuctionStatus.SCHEDULED,
  AuctionStatus.ACTIVE,
];

export function assertValidAuctionTransition(
  from: AuctionStatus,
  to: AuctionStatus,
): void {
  if (!FORWARD_TRANSITIONS[from]?.includes(to)) {
    throw new ConflictException(
      `Cannot transition auction from ${from} to ${to}`,
    );
  }
}

export function isAuctionCancellable(status: AuctionStatus): boolean {
  return CANCELLABLE_FROM.includes(status);
}

export function assertAuctionCancellable(status: AuctionStatus): void {
  if (!isAuctionCancellable(status)) {
    throw new ConflictException(
      `An auction in status ${status} cannot be cancelled`,
    );
  }
}

/** True once startsAt has passed and endsAt has not — used to self-heal a
 * SCHEDULED auction into ACTIVE at the moment a bid is attempted, so
 * correctness never depends on a background "start" job having already
 * run. */
export function isWithinBiddingWindow(
  startsAt: Date,
  endsAt: Date,
  now: Date,
): boolean {
  return (
    now.getTime() >= startsAt.getTime() && now.getTime() < endsAt.getTime()
  );
}
