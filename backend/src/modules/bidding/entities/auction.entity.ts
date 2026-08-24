import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  VersionColumn,
} from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';
import { AuctionStatus } from './auction-status.enum';
import { Bid } from './bid.entity';

/**
 * `version` backs TypeORM's optimistic locking so concurrent bid writes in
 * Stage 6 can detect conflicting updates to currentPrice; a pessimistic
 * `SELECT ... FOR UPDATE` on the row is the alternative the schema equally
 * supports if optimistic locking proves too contentious under load.
 */
@Entity('auctions')
@Index('IDX_auction_status_ends', ['status', 'endsAt'])
@Index('IDX_auction_status_purchase_window', ['status', 'purchaseWindowEndsAt'])
export class Auction extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  productId: string;

  @OneToOne(() => Product, (product) => product.auction, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  startPrice: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  currentPrice: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  minBidIncrement: string;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  @Index('IDX_auction_winner')
  @Column({ type: 'uuid', nullable: true })
  winnerId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'winnerId' })
  winner: User | null;

  @Index('IDX_auction_winning_bid')
  @Column({ type: 'uuid', nullable: true })
  winningBidId: string | null;

  @ManyToOne(() => Bid, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'winningBidId' })
  winningBid: Bid | null;

  @Column({ type: 'timestamptz', nullable: true })
  purchaseWindowEndsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finalizedAt: Date | null;

  @Column({
    type: 'enum',
    enum: AuctionStatus,
    default: AuctionStatus.SCHEDULED,
  })
  status: AuctionStatus;

  @VersionColumn()
  version: number;

  @OneToMany(() => Bid, (bid) => bid.auction)
  bids: Bid[];
}
