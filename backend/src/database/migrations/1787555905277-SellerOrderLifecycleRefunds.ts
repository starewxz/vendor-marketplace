import { MigrationInterface, QueryRunner } from 'typeorm';

export class SellerOrderLifecycleRefunds1787555905277 implements MigrationInterface {
  name = 'SellerOrderLifecycleRefunds1787555905277';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IDX_products_name_trgm is a raw-SQL gin_trgm_ops index not
    // represented in entity decorators, so TypeORM's diff always sees
    // it as "extra" and generates a DROP for it — deliberately not run
    // here, otherwise trigram search silently breaks (see Stage 4
    // migration for the same false positive).
    await queryRunner.query(`ALTER TABLE "refunds" DROP COLUMN "processedAt"`);
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD "sellerOrderItemId" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD "quantity" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD "commissionAdjustment" numeric(12,2) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD "sellerAdjustment" numeric(12,2) NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."refunds_status_enum" AS ENUM('PROCESSING', 'COMPLETED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD "status" "public"."refunds_status_enum" NOT NULL DEFAULT 'PROCESSING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD "idempotencyKey" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD "initiatedBy" uuid NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "refunds" ADD "correlationId" uuid`);
    await queryRunner.query(`ALTER TABLE "ledger_entries" ADD "refundId" uuid`);
    await queryRunner.query(
      `ALTER TYPE "public"."orders_status_enum" RENAME TO "orders_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_status_enum" AS ENUM('NEW', 'PROCESSING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'PARTIALLY_COMPLETED', 'COMPLETED', 'PARTIALLY_CANCELLED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "status" TYPE "public"."orders_status_enum" USING "status"::"text"::"public"."orders_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'NEW'`,
    );
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."ledger_entries_type_enum" ADD VALUE 'SELLER_EARNING_REVERSAL'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."ledger_entries_type_enum" ADD VALUE 'PLATFORM_COMMISSION_REVERSAL'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_031ab242868f7e5c1863e65e0d" ON "refunds"  ("sellerOrderItemId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cbb4c924ed7d4f1a5520f75851" ON "refunds"  ("correlationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_496cb2d36d92763179252ac67a" ON "refunds"  ("sellerOrderId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fe6595be7bb88c6bbf44df8ebb" ON "refunds"  ("sellerOrderId", "idempotencyKey") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_775c9f06fc27ae3ff8fb26f2c4" ON "orders"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eb4551a1be12d61068a1fce98f" ON "ledger_entries"  ("refundId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD CONSTRAINT "FK_031ab242868f7e5c1863e65e0dd" FOREIGN KEY ("sellerOrderItemId") REFERENCES "seller_order_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refunds" DROP CONSTRAINT "FK_031ab242868f7e5c1863e65e0dd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_eb4551a1be12d61068a1fce98f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_775c9f06fc27ae3ff8fb26f2c4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fe6595be7bb88c6bbf44df8ebb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_496cb2d36d92763179252ac67a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cbb4c924ed7d4f1a5520f75851"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_031ab242868f7e5c1863e65e0d"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_entries_type_enum_old" AS ENUM('SALE_CREDIT', 'COMMISSION_DEBIT', 'REFUND_DEBIT', 'PAYOUT_DEBIT', 'ADJUSTMENT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ALTER COLUMN "type" TYPE "public"."ledger_entries_type_enum_old" USING "type"::"text"::"public"."ledger_entries_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."ledger_entries_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."ledger_entries_type_enum_old" RENAME TO "ledger_entries_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_status_enum_old" AS ENUM('PENDING_PAYMENT', 'PAID', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "status" TYPE "public"."orders_status_enum_old" USING "status"::"text"::"public"."orders_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."orders_status_enum_old" RENAME TO "orders_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP COLUMN "refundId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" DROP COLUMN "correlationId"`,
    );
    await queryRunner.query(`ALTER TABLE "refunds" DROP COLUMN "initiatedBy"`);
    await queryRunner.query(
      `ALTER TABLE "refunds" DROP COLUMN "idempotencyKey"`,
    );
    await queryRunner.query(`ALTER TABLE "refunds" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."refunds_status_enum"`);
    await queryRunner.query(
      `ALTER TABLE "refunds" DROP COLUMN "sellerAdjustment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" DROP COLUMN "commissionAdjustment"`,
    );
    await queryRunner.query(`ALTER TABLE "refunds" DROP COLUMN "quantity"`);
    await queryRunner.query(
      `ALTER TABLE "refunds" DROP COLUMN "sellerOrderItemId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD "processedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }
}
