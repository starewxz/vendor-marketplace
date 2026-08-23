import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SellerOrder } from '../../orders/entities/seller-order.entity';
import { User } from '../../users/entities/user.entity';
import { DisputeStatus } from './dispute-status.enum';

@Entity('disputes')
export class Dispute extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  sellerOrderId: string;

  @ManyToOne(() => SellerOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerOrderId' })
  sellerOrder: SellerOrder;

  @Column({ type: 'uuid' })
  raisedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'raisedByUserId' })
  raisedBy: User;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @Column({ type: 'uuid', nullable: true })
  resolvedByUserId: string | null;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
