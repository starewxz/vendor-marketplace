import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';

@Entity('reviews')
@Index(['productId', 'authorId'], { unique: true })
export class Review extends BaseEntity {
  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @ManyToOne(() => Order, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;
}
