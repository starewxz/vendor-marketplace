import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';
import { AuthProvider } from './auth-provider.enum';

/**
 * Links a User to an external identity provider (currently only GOOGLE —
 * LOCAL auth doesn't need a row here, see AuthProvider). Kept separate from
 * User so a future provider (e.g. Apple, GitHub) is one new enum value and
 * a row, not a new column on User.
 */
@Entity('auth_identities')
@Index(['provider', 'providerUserId'], { unique: true })
export class AuthIdentity extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: AuthProvider })
  provider: AuthProvider;

  @Column({ type: 'varchar' })
  providerUserId: string;
}
