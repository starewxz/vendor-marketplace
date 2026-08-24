/** Shared BullMQ job payload shape for both delayed triggers on the
 * AUCTION_FINALIZATION queue — see AuctionFinalizationProcessor. */
export type AuctionJobType = 'FINALIZE' | 'EXPIRE_PURCHASE_WINDOW';

export interface AuctionFinalizationJobData {
  type: AuctionJobType;
  auctionId: string;
  correlationId: string;
}
