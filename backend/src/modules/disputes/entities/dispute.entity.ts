import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SellerOrder } from '../../orders/entities/seller-order.entity';
import { User } from '../../users/entities/user.entity';
import { SellerProfile } from '../../sellers/entities/seller-profile.entity';
import { DisputeStatus } from './dispute-status.enum';

@Entity('disputes')
@Index(['sellerOrderId'], {
  unique: true,
  where: `"status" IN ('OPEN', 'UNDER_REVIEW')`,
})
export class Dispute extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  sellerOrderId: string;

  @ManyToOne(() => SellerOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerOrderId' })
  sellerOrder: SellerOrder;

  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Index()
  @Column({ type: 'uuid' })
  sellerProfileId: string;

  @ManyToOne(() => SellerProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerProfileId' })
  sellerProfile: SellerProfile;

  @Column({ type: 'varchar', length: 120 })
  reason: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @Column({ type: 'uuid', nullable: true })
  resolvedByUserId: string | null;

  @Column({ type: 'text', nullable: true })
  adminResolution: string | null;

  @Column({ type: 'text', nullable: true })
  sellerResponse: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
