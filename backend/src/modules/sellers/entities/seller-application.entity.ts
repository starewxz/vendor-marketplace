import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';
import { SellerApplicationStatus } from './seller-application-status.enum';

/**
 * The partial unique index enforces "at most one PENDING application per
 * user" at the database level — the service also checks this before insert,
 * but the constraint is what actually prevents a race between two
 * concurrent submissions from creating two PENDING rows.
 */
@Entity('seller_applications')
@Index('idx_seller_applications_one_pending_per_user', ['userId'], {
  unique: true,
  where: `"status" = 'PENDING'`,
})
export class SellerApplication extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar' })
  requestedStoreName: string;

  @Column({ type: 'text' })
  businessDescription: string;

  @Column({
    type: 'enum',
    enum: SellerApplicationStatus,
    default: SellerApplicationStatus.PENDING,
  })
  status: SellerApplicationStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewedByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;
}
