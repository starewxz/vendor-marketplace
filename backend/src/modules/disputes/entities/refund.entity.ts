import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SellerOrder } from '../../orders/entities/seller-order.entity';
import { Dispute } from './dispute.entity';

@Entity('refunds')
export class Refund extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  sellerOrderId: string;

  @ManyToOne(() => SellerOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerOrderId' })
  sellerOrder: SellerOrder;

  @Column({ type: 'uuid', nullable: true })
  disputeId: string | null;

  @ManyToOne(() => Dispute, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'disputeId' })
  dispute: Dispute | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
