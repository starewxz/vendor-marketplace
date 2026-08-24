import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReviewsDisputesAnalytics1787564000000 implements MigrationInterface {
  name = 'ReviewsDisputesAnalytics1787564000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_a917d8a850b61f4cb2950594d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_48770372f891b9998360e4434f3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_53a68dc905777554b7f702791fa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" RENAME COLUMN "authorId" TO "customerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD "sellerOrderItemId" uuid`,
    );
    await queryRunner.query(
      `UPDATE "reviews" r SET "sellerOrderItemId" = (SELECT soi.id FROM seller_order_items soi JOIN seller_orders so ON so.id=soi."sellerOrderId" JOIN orders o ON o.id=so."orderId" WHERE soi."productId"=r."productId" AND o."buyerId"=r."customerId" AND (r."orderId" IS NULL OR o.id=r."orderId") ORDER BY soi."createdAt" DESC LIMIT 1)`,
    );
    await queryRunner.query(
      `DELETE FROM "reviews" WHERE "sellerOrderItemId" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ALTER COLUMN "sellerOrderItemId" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "orderId"`);
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_reviews_customer" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_reviews_seller_order_item" FOREIGN KEY ("sellerOrderItemId") REFERENCES "seller_order_items"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "CHK_reviews_rating" CHECK (rating BETWEEN 1 AND 5)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_reviews_purchase_customer" ON "reviews" ("sellerOrderItemId", "customerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_product_created" ON "reviews" ("productId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_seller_order_item" ON "reviews" ("sellerOrderItemId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT IF EXISTS "FK_747b43fbe9acdac10fd4bf41492"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" RENAME COLUMN "raisedByUserId" TO "customerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" RENAME COLUMN "resolutionNotes" TO "adminResolution"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD "sellerProfileId" uuid`,
    );
    await queryRunner.query(`ALTER TABLE "disputes" ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "disputes" ADD "sellerResponse" text`);
    await queryRunner.query(
      `UPDATE "disputes" d SET "sellerProfileId"=so."sellerProfileId", description=d.reason FROM seller_orders so WHERE so.id=d."sellerOrderId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "sellerProfileId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "description" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "reason" TYPE varchar(120) USING LEFT("reason",120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."disputes_status_enum" RENAME TO "disputes_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."disputes_status_enum" AS ENUM('OPEN','UNDER_REVIEW','RESOLVED_CUSTOMER','RESOLVED_SELLER','CLOSED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "status" TYPE "public"."disputes_status_enum" USING (CASE WHEN "status"::text='RESOLVED' THEN 'RESOLVED_CUSTOMER' WHEN "status"::text='REJECTED' THEN 'RESOLVED_SELLER' ELSE "status"::text END)::"public"."disputes_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "status" SET DEFAULT 'OPEN'`,
    );
    await queryRunner.query(`DROP TYPE "public"."disputes_status_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_disputes_customer" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_disputes_seller" FOREIGN KEY ("sellerProfileId") REFERENCES "seller_profiles"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_disputes_customer" ON "disputes" ("customerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_disputes_seller" ON "disputes" ("sellerProfileId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_disputes_status_created" ON "disputes" ("status", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_disputes_one_active_per_order" ON "disputes" ("sellerOrderId") WHERE "status" IN ('OPEN','UNDER_REVIEW')`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refunds_dispute" ON "refunds" ("disputeId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ledger_created_seller" ON "ledger_entries" ("createdAt", "sellerProfileId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_created_seller"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refunds_dispute"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_disputes_one_active_per_order"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_disputes_status_created"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_seller"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_customer"`);
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT IF EXISTS "FK_disputes_seller"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT IF EXISTS "FK_disputes_customer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."disputes_status_enum" RENAME TO "disputes_status_enum_new"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."disputes_status_enum" AS ENUM('OPEN','UNDER_REVIEW','RESOLVED','REJECTED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "status" TYPE "public"."disputes_status_enum" USING (CASE WHEN "status"::text='RESOLVED_CUSTOMER' THEN 'RESOLVED' WHEN "status"::text IN ('RESOLVED_SELLER','CLOSED') THEN 'REJECTED' ELSE "status"::text END)::"public"."disputes_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "status" SET DEFAULT 'OPEN'`,
    );
    await queryRunner.query(`DROP TYPE "public"."disputes_status_enum_new"`);
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP COLUMN "sellerResponse"`,
    );
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "description"`);
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP COLUMN "sellerProfileId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "reason" TYPE text`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" RENAME COLUMN "adminResolution" TO "resolutionNotes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" RENAME COLUMN "customerId" TO "raisedByUserId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_747b43fbe9acdac10fd4bf41492" FOREIGN KEY ("raisedByUserId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reviews_seller_order_item"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reviews_product_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_reviews_purchase_customer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "CHK_reviews_rating"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_seller_order_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_customer"`,
    );
    await queryRunner.query(`ALTER TABLE "reviews" ADD "orderId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP COLUMN "sellerOrderItemId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" RENAME COLUMN "customerId" TO "authorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_48770372f891b9998360e4434f3" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_53a68dc905777554b7f702791fa" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a917d8a850b61f4cb2950594d5" ON "reviews" ("productId", "authorId")`,
    );
  }
}
