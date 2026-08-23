import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('seller_profiles')
export class SellerProfile extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  storeName: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  storeSlug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 10 })
  commissionRatePercent: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
