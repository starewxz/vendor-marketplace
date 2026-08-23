import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogAndSearch1787519549911 implements MigrationInterface {
  name = 'CatalogAndSearch1787519549911';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD "ratingAverage" numeric(3,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "ratingCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8b0be371d28245da6e4f4b6187" ON "categories"  ("name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_63fcb3d8806a6efd53dbc67430" ON "products"  ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_425213a5ac15d6762e8efe744c" ON "products"  ("stockQuantity") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_75895eeb1903f8a17816dafe0a" ON "products"  ("price") `,
    );

    // pg_trgm powers a GIN trigram index on products.name so the
    // Postgres fallback path's `name ILIKE '%term%'` (used when
    // Meilisearch is unavailable — see PostgresCatalogFallbackService)
    // doesn't degrade to a full sequential scan.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(
      `CREATE INDEX "IDX_products_name_trgm" ON "products" USING gin ("name" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_products_name_trgm"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_75895eeb1903f8a17816dafe0a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_425213a5ac15d6762e8efe744c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_63fcb3d8806a6efd53dbc67430"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8b0be371d28245da6e4f4b6187"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "ratingCount"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "ratingAverage"`,
    );
  }
}
