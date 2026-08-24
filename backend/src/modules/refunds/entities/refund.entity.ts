import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SellerOrder } from '../../orders/entities/seller-order.entity';
import { SellerOrderItem } from '../../orders/entities/seller-order-item.entity';
import { Dispute } from '../../disputes/entities/dispute.entity';
import { RefundStatus } from './refund-status.enum';

/**
 * Item-level partial refund. Doubles as its own idempotency claim — the
 * unique index on (sellerOrderId, idempotencyKey) is what makes a retried
 * or concurrently-duplicated admin request produce exactly one Refund (see
 * RefundsService.createRefund, same insert-first pattern as
 * CheckoutIdempotencyKey).
 *
 * `amount`/`commissionAdjustment`/`sellerAdjustment` are always computed
 * server-side from the SellerOrderItem's immutable purchase snapshot —
 * never accepted from the client — and are append-only history: cancelling
 * or refunding never rewrites the original SellerOrder/SellerOrderItem
 * figures or a prior Refund row.
 */
@Entity('refunds')
@Index(['sellerOrderId', 'idempotencyKey'], { unique: true })
@Index(['sellerOrderId', 'createdAt'])
export class Refund extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  sellerOrderId: string;

  @ManyToOne(() => SellerOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerOrderId' })
  sellerOrder: SellerOrder;

  @Index()
  @Column({ type: 'uuid' })
  sellerOrderItemId: string;

  @ManyToOne(() => SellerOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerOrderItemId' })
  sellerOrderItem: SellerOrderItem;

  // Reserved for a future dispute-driven-refund flow — always null for the
  // admin-initiated refunds this stage creates. Disputes are out of scope
  // for this stage (see README "Scope").
  @Column({ type: 'uuid', nullable: true })
  disputeId: string | null;

  @ManyToOne(() => Dispute, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'disputeId' })
  dispute: Dispute | null;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  commissionAdjustment: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  sellerAdjustment: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({
    type: 'enum',
    enum: RefundStatus,
    default: RefundStatus.PROCESSING,
  })
  status: RefundStatus;

  @Column({ type: 'varchar' })
  idempotencyKey: string;

  @Column({ type: 'uuid' })
  initiatedBy: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  correlationId: string | null;
}
