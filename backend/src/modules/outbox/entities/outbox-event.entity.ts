import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { OutboxStatus } from './outbox-status.enum';

/**
 * Written in the same DB transaction as the domain change it describes.
 * A separate worker polls PENDING rows and relays them to BullMQ, so
 * consumers (search-sync, notifications, etc.) never need a dual write to
 * both Postgres and an external system — see README "Consistency model".
 */
@Entity('outbox_events')
@Index(['status', 'createdAt'])
export class OutboxEvent extends BaseEntity {
  @Column({ type: 'varchar' })
  eventType: string;

  @Column({ type: 'varchar' })
  aggregateType: string;

  @Index()
  @Column({ type: 'uuid' })
  aggregateId: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Index()
  @Column({ type: 'uuid' })
  correlationId: string;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'enum', enum: OutboxStatus, default: OutboxStatus.PENDING })
  status: OutboxStatus;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;
}
