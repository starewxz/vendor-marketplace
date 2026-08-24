import { Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Product } from '../products/entities/product.entity';

/**
 * Plain atomic increment — unlike checkout's guarded decrement, restoring
 * stock has no business condition that can make it "insufficient", so
 * there's no WHERE guard beyond the id match. `affected === 0` only means
 * the product itself is gone (deleted since purchase, the same case
 * SellerOrderItem.productId already handles via ON DELETE SET NULL) —
 * logged and skipped rather than thrown, since there's nothing to restore
 * stock *to*.
 */
export async function restoreProductStock(
  manager: EntityManager,
  productId: string,
  quantity: number,
  correlationId: string,
  logger: Logger,
): Promise<boolean> {
  const result = await manager
    .createQueryBuilder()
    .update(Product)
    .set({ stockQuantity: () => '"stockQuantity" + :qty' })
    .where('id = :id', { id: productId })
    .setParameter('qty', quantity)
    .execute();

  if (result.affected === 0) {
    logger.warn(
      `[${correlationId}] stock restoration skipped — product ${productId} no longer exists`,
    );
    return false;
  }
  return true;
}
