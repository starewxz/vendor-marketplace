import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Auction } from './auction.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Append-only — a Bid is never updated or deleted once inserted. Doubles as
 * its own idempotency claim, same pattern as Refund: the unique index on
 * (auctionId, bidderId, idempotencyKey) is what makes a retried bid request
 * produce exactly one row (see BidPlacementService).
 */
@Entity('bids')
@Index(['auctionId', 'bidderId', 'idempotencyKey'], { unique: true })
export class Bid extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  auctionId: string;

  @ManyToOne(() => Auction, (auction) => auction.bids, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auctionId' })
  auction: Auction;

  @Index()
  @Column({ type: 'uuid' })
  bidderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bidderId' })
  bidder: User;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar' })
  idempotencyKey: string;
}
