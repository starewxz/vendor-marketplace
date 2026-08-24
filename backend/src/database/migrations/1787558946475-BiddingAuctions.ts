import { MigrationInterface, QueryRunner } from 'typeorm';

export class BiddingAuctions1787558946475 implements MigrationInterface {
  name = 'BiddingAuctions1787558946475';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."auctions_status_enum" ADD VALUE IF NOT EXISTS 'UNSOLD'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."auctions_status_enum" ADD VALUE IF NOT EXISTS 'EXPIRED'`,
    );
    // IDX_products_name_trgm is a raw-SQL gin_trgm_ops index not
    // represented in entity decorators, so TypeORM's diff always sees it
    // as "extra" and generates a DROP for it — deliberately not run here
    // (see the Stage 5 migration for the same false positive).
    await queryRunner.query(
      `ALTER TABLE "bids" ADD "idempotencyKey" character varying NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "auctions" ADD "winningBidId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "auctions" ADD "finalizedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bee3b734f14b612c50e860c04d" ON "bids"  ("auctionId", "bidderId", "idempotencyKey") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auction_winning_bid" ON "auctions" ("winningBidId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auction_winner" ON "auctions" ("winnerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auction_status_ends" ON "auctions" ("status", "endsAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auction_status_purchase_window" ON "auctions" ("status", "purchaseWindowEndsAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" ADD CONSTRAINT "FK_auction_winning_bid" FOREIGN KEY ("winningBidId") REFERENCES "bids"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auctions" DROP CONSTRAINT "FK_auction_winning_bid"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_auction_status_purchase_window"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_auction_status_ends"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_auction_winner"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_auction_winning_bid"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bee3b734f14b612c50e860c04d"`,
    );
    await queryRunner.query(`ALTER TABLE "bids" DROP COLUMN "idempotencyKey"`);
    await queryRunner.query(`ALTER TABLE "auctions" DROP COLUMN "finalizedAt"`);
    await queryRunner.query(
      `ALTER TABLE "auctions" DROP COLUMN "winningBidId"`,
    );
  }
}
