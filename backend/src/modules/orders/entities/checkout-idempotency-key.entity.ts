import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { CheckoutIdempotencyStatus } from './checkout-idempotency-status.enum';

/**
 * Persisted (Postgres, not Redis) idempotency claim for POST /cart/checkout.
 * A row is inserted at the *start* of the checkout transaction as an
 * atomic claim on (customerId, idempotencyKey) — the unique index is what
 * actually makes two concurrent requests with the same key safe: the loser
 * blocks on the winner's row lock, then either sees COMPLETED (replay) or,
 * if the winner rolled back, finds no row and proceeds normally.
 *
 * There is no FAILED status: a failed checkout rolls back the whole
 * transaction, including this insert, so a failed attempt never leaves a
 * durable row — the key remains reusable.
 */
@Entity('checkout_idempotency_keys')
@Index(['customerId', 'idempotencyKey'], { unique: true })
export class CheckoutIdempotencyKey extends BaseEntity {
  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'varchar' })
  idempotencyKey: string;

  @Column({
    type: 'enum',
    enum: CheckoutIdempotencyStatus,
    default: CheckoutIdempotencyStatus.PROCESSING,
  })
  status: CheckoutIdempotencyStatus;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;
}
