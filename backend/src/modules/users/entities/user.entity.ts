import { Column, Entity, Index, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { UserRole } from './user-role.enum';
import { SellerProfile } from '../../sellers/entities/seller-profile.entity';

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar', nullable: true, select: false })
  passwordHash: string | null;

  @Column({ type: 'varchar' })
  firstName: string;

  @Column({ type: 'varchar' })
  lastName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToOne(() => SellerProfile, (sellerProfile) => sellerProfile.user)
  sellerProfile?: SellerProfile;
}
