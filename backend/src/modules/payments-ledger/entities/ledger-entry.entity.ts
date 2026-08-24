import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SellerProfile } from '../../sellers/entities/seller-profile.entity';
import { LedgerEntryType } from './ledger-entry-type.enum';

/**
 * Append-only ledger row. Balances are always derived by summing entries
 * rather than mutated in place, keeping the seller's financial history
 * auditable and immune to lost-update races.
 */
@Entity('ledger_entries')
export class LedgerEntry extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  sellerProfileId: string;

  @ManyToOne(() => SellerProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerProfileId' })
  sellerProfile: SellerProfile;

  @Column({ type: 'enum', enum: LedgerEntryType })
  type: LedgerEntryType;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  sellerOrderId: string | null;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  // Ties a ledger row back to the request that created it — the same
  // correlationId is threaded through the checkout transaction's outbox
  // events, so a support/audit query can find everything one checkout
  // produced.
  @Index()
  @Column({ type: 'uuid', nullable: true })
  correlationId: string | null;
}
