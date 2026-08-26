import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { DeadLetterStatus } from './dead-letter-status.enum';

/**
 * Created when a BullMQ job exhausts every configured retry attempt (see
 * DeadLetterListenerService) — the operational record that a permanently
 * failed async job/event is observable and replayable instead of silently
 * disappearing once BullMQ's own `removeOnFail` eventually prunes it from
 * Redis. Persisted in Postgres (not Redis) so it survives a Redis restart.
 *
 * `payload` is the job's own data (ids, event type, correlation id — the
 * same shape already written to OutboxEvent.payload elsewhere in this
 * module) and never contains credentials/secrets.
 */
@Entity('dead_letter_events')
@Index(['originalQueue', 'jobId'], { unique: true })
@Index(['status', 'createdAt'])
export class DeadLetterEvent extends BaseEntity {
  @Column({ type: 'varchar' })
  originalQueue: string;

  @Column({ type: 'varchar' })
  jobId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  outboxEventId: string | null;

  @Column({ type: 'varchar' })
  eventType: string;

  @Column({ type: 'varchar', nullable: true })
  aggregateType: string | null;

  @Column({ type: 'varchar', nullable: true })
  aggregateId: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'integer' })
  attemptsMade: number;

  @Column({ type: 'text' })
  failureReason: string;

  @Index()
  @Column({ type: 'uuid' })
  correlationId: string;

  @Column({ type: 'timestamptz' })
  failedAt: Date;

  @Column({
    type: 'enum',
    enum: DeadLetterStatus,
    default: DeadLetterStatus.PENDING,
  })
  status: DeadLetterStatus;

  @Column({ type: 'timestamptz', nullable: true })
  replayedAt: Date | null;
}
