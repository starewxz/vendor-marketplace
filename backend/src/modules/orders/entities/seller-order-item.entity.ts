import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SellerOrder } from './seller-order.entity';
import { Product } from '../../products/entities/product.entity';

/**
 * Immutable purchase snapshot: productName/unitPrice are copied at checkout
 * time so historical orders remain accurate even if the Product is later
 * renamed, repriced, or deleted.
 */
@Entity('seller_order_items')
export class SellerOrderItem extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  sellerOrderId: string;

  @ManyToOne(() => SellerOrder, (sellerOrder) => sellerOrder.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sellerOrderId' })
  sellerOrder: SellerOrder;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'productId' })
  product: Product | null;

  @Column({ type: 'varchar' })
  productName: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  unitPrice: string;

  @Column({ type: 'integer' })
  quantity: number;
}
