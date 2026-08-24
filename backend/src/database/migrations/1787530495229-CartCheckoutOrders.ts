import { MigrationInterface, QueryRunner } from 'typeorm';

export class CartCheckoutOrders1787530495229 implements MigrationInterface {
  name = 'CartCheckoutOrders1787530495229';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IDX_products_name_trgm is a raw-SQL gin_trgm_ops index created in
    // CatalogAndSearch and isn't represented in entity decorators, so
    // TypeORM's diff sees it as "extra" and generates a DROP for it —
    // deliberately not run here, otherwise trigram search silently breaks.
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9877ffd9a491c3e82f5b32d4f4"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."checkout_idempotency_keys_status_enum" AS ENUM('PROCESSING', 'COMPLETED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "checkout_idempotency_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "customerId" uuid NOT NULL, "idempotencyKey" character varying NOT NULL, "status" "public"."checkout_idempotency_keys_status_enum" NOT NULL DEFAULT 'PROCESSING', "orderId" uuid, CONSTRAINT "PK_a154990b7e174e25d0dac2af732" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ee575823008df9d5e817f21a56" ON "checkout_idempotency_keys"  ("customerId", "idempotencyKey") `,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_order_items" ADD "lineTotal" numeric(12,2) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ADD "correlationId" uuid`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."seller_orders_status_enum" ADD VALUE 'PROCESSING'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_72679d98b31c737937b8932ebe" ON "cart_items"  ("productId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d78e8299db1f3584ed583f41e3" ON "seller_order_items"  ("productId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_93287fffbd8b9eca5204b68b54" ON "seller_orders"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1599731080e7ce8506d74f63d8" ON "orders"  ("buyerId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_76b31f094987945c12bbda6fa7" ON "ledger_entries"  ("sellerOrderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_255d00067aa3973f2aac1e8484" ON "ledger_entries"  ("correlationId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_255d00067aa3973f2aac1e8484"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_76b31f094987945c12bbda6fa7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1599731080e7ce8506d74f63d8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_93287fffbd8b9eca5204b68b54"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d78e8299db1f3584ed583f41e3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_72679d98b31c737937b8932ebe"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."seller_orders_status_enum_old" AS ENUM('AWAITING_FULFILLMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')`,
    );
    // The column default is bound to the enum type, so Postgres refuses
    // to cast it automatically — drop it, swap the type, then restore it.
    await queryRunner.query(
      `ALTER TABLE "seller_orders" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_orders" ALTER COLUMN "status" TYPE "public"."seller_orders_status_enum_old" USING "status"::"text"::"public"."seller_orders_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_orders" ALTER COLUMN "status" SET DEFAULT 'AWAITING_FULFILLMENT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."seller_orders_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."seller_orders_status_enum_old" RENAME TO "seller_orders_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP COLUMN "correlationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_order_items" DROP COLUMN "lineTotal"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ee575823008df9d5e817f21a56"`,
    );
    await queryRunner.query(`DROP TABLE "checkout_idempotency_keys"`);
    await queryRunner.query(
      `DROP TYPE "public"."checkout_idempotency_keys_status_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9877ffd9a491c3e82f5b32d4f4" ON "orders" USING btree ("buyerId") `,
    );
  }
}
