import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';
import { SellerOrderItem } from '../../orders/entities/seller-order-item.entity';

@Entity('reviews')
@Index(['sellerOrderItemId', 'customerId'], { unique: true })
@Index(['productId', 'customerId'], { unique: true })
@Index(['productId', 'createdAt'])
export class Review extends BaseEntity {
  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Index()
  @Column({ type: 'uuid' })
  sellerOrderItemId: string;

  @ManyToOne(() => SellerOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerOrderItemId' })
  sellerOrderItem: SellerOrderItem;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;
}
