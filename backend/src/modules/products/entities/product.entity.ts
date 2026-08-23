import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { SellerProfile } from '../../sellers/entities/seller-profile.entity';
import { Category } from '../../categories/entities/category.entity';
import { ProductType } from './product-type.enum';

@Entity('products')
export class Product extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  sellerProfileId: string;

  @ManyToOne(() => SellerProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerProfileId' })
  sellerProfile: SellerProfile;

  @Index()
  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ type: 'varchar' })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ProductType, default: ProductType.FIXED_PRICE })
  type: ProductType;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price: string | null;

  @Column({ type: 'integer', default: 0 })
  stockQuantity: number;

  @Column({ type: 'varchar', array: true, default: () => "'{}'" })
  imageUrls: string[];

  @Column({ type: 'boolean', default: false })
  isPublished: boolean;
}
