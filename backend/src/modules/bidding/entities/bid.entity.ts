import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Auction } from './auction.entity';
import { User } from '../../users/entities/user.entity';

@Entity('bids')
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
}
