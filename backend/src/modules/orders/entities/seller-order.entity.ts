import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Order } from './order.entity';
import { SellerProfile } from '../../sellers/entities/seller-profile.entity';
import { SellerOrderStatus } from './seller-order-status.enum';
import { SellerOrderItem } from './seller-order-item.entity';
import { Refund } from '../../refunds/entities/refund.entity';

/**
 * One seller's slice of a multi-vendor Order. Holds the financial split
 * (subtotal / commission / net) so commission logic in later stages can be
 * computed once per seller and never touch the parent Order's total.
 */
@Entity('seller_orders')
export class SellerOrder extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.sellerOrders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Index()
  @Column({ type: 'uuid' })
  sellerProfileId: string;

  @ManyToOne(() => SellerProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerProfileId' })
  sellerProfile: SellerProfile;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  subtotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  commissionAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  sellerNetAmount: string;

  @Index()
  @Column({
    type: 'enum',
    enum: SellerOrderStatus,
    default: SellerOrderStatus.AWAITING_FULFILLMENT,
  })
  status: SellerOrderStatus;

  @OneToMany(() => SellerOrderItem, (item) => item.sellerOrder)
  items: SellerOrderItem[];

  @OneToMany(() => Refund, (refund) => refund.sellerOrder)
  refunds: Refund[];
}
