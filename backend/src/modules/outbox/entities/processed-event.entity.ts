import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';

/**
 * Idempotency record: a consumer inserts one row per (consumerName,
 * outboxEventId) before acting on an event. A unique constraint makes a
 * duplicate delivery (BullMQ at-least-once retry, worker restart) a no-op
 * instead of double-processing.
 */
@Entity('processed_events')
@Index(['consumerName', 'outboxEventId'], { unique: true })
export class ProcessedEvent extends BaseEntity {
  @Column({ type: 'varchar' })
  consumerName: string;

  @Column({ type: 'uuid' })
  outboxEventId: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  processedAt: Date;
}
