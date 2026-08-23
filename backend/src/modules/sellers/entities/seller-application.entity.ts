import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';
import { SellerApplicationStatus } from './seller-application-status.enum';

@Entity('seller_applications')
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
