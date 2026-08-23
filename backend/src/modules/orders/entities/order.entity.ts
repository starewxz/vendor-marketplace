import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';
import { OrderStatus } from './order-status.enum';
import { SellerOrder } from './seller-order.entity';

@Entity('orders')
export class Order extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  buyerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  totalAmount: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING_PAYMENT,
  })
  status: OrderStatus;

  @Column({ type: 'varchar', nullable: true })
  shippingAddressLine1: string | null;

  @Column({ type: 'varchar', nullable: true })
  shippingAddressLine2: string | null;

  @Column({ type: 'varchar', nullable: true })
  shippingCity: string | null;

  @Column({ type: 'varchar', nullable: true })
  shippingPostalCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  shippingCountry: string | null;

  @OneToMany(() => SellerOrder, (sellerOrder) => sellerOrder.order)
  sellerOrders: SellerOrder[];
}
