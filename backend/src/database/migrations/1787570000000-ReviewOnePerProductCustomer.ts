import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The original unique index on (sellerOrderItemId, customerId) only stops a
 * duplicate review of the same purchased line item — a customer who bought
 * the same product across two separate SellerOrderItems could still submit
 * two reviews for one product. The spec requires one review per
 * (product, customer), so enforce that at the DB level too.
 */
export class ReviewOnePerProductCustomer1787570000000 implements MigrationInterface {
  name = 'ReviewOnePerProductCustomer1787570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "reviews" r USING "reviews" r2 WHERE r."productId" = r2."productId" AND r."customerId" = r2."customerId" AND r."createdAt" > r2."createdAt"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_reviews_product_customer" ON "reviews" ("productId", "customerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_reviews_product_customer"`);
  }
}
