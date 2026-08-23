import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1787513929418 implements MigrationInterface {
  name = 'InitialSchema1787513929418';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "seller_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "storeName" character varying NOT NULL, "storeSlug" character varying NOT NULL, "description" text, "logoUrl" character varying, "commissionRatePercent" numeric(5,2) NOT NULL DEFAULT '10', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "REL_49de7dde25d76b120677be9aed" UNIQUE ("userId"), CONSTRAINT "PK_13845670b88adfde01026410969" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_49de7dde25d76b120677be9aed" ON "seller_profiles"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_021884245647d067661df78931" ON "seller_profiles"  ("storeName") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_64d97ba7c48919953474c6d69e" ON "seller_profiles"  ("storeSlug") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('CUSTOMER', 'SELLER', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying NOT NULL, "passwordHash" character varying, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "googleId" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'CUSTOMER', "isEmailVerified" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "userAgent" character varying, "ipAddress" character varying, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON "refresh_tokens"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c25bc63d248ca90e8dcc1d92d0" ON "refresh_tokens"  ("tokenHash") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."seller_applications_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "seller_applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "requestedStoreName" character varying NOT NULL, "businessDescription" text NOT NULL, "status" "public"."seller_applications_status_enum" NOT NULL DEFAULT 'PENDING', "reviewedByUserId" uuid, "reviewedAt" TIMESTAMP WITH TIME ZONE, "rejectionReason" text, CONSTRAINT "PK_203be9b9b1f8ff560e8af1f90a5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bc16b54496faa4ffae868a999c" ON "seller_applications"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "parentId" uuid, "iconUrl" character varying, "sortOrder" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_420d9f679d41281f282f5bc7d0" ON "categories"  ("slug") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."products_type_enum" AS ENUM('FIXED_PRICE', 'AUCTION')`,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sellerProfileId" uuid NOT NULL, "categoryId" uuid NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "description" text, "type" "public"."products_type_enum" NOT NULL DEFAULT 'FIXED_PRICE', "price" numeric(12,2), "stockQuantity" integer NOT NULL DEFAULT '0', "imageUrls" character varying array NOT NULL DEFAULT '{}', "isPublished" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c2362430f78a82f97fec8ab2ec" ON "products"  ("sellerProfileId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ff56834e735fa78a15d0cf2192" ON "products"  ("categoryId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_464f927ae360106b783ed0b410" ON "products"  ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "cart_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "cartId" uuid NOT NULL, "productId" uuid NOT NULL, "quantity" integer NOT NULL, CONSTRAINT "PK_6fccf5ec03c172d27a28a82928b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2bf7996b7946ce753b60a87468" ON "cart_items"  ("cartId", "productId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "carts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, CONSTRAINT "REL_69828a178f152f157dcf2f70a8" UNIQUE ("userId"), CONSTRAINT "PK_b5f695a59f5ebb50af3c8160816" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_69828a178f152f157dcf2f70a8" ON "carts"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "seller_order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sellerOrderId" uuid NOT NULL, "productId" uuid, "productName" character varying NOT NULL, "unitPrice" numeric(12,2) NOT NULL, "quantity" integer NOT NULL, CONSTRAINT "PK_57afe6d34b7e8e586dfd9ab250d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8ba1c26f21384a93acb94ab738" ON "seller_order_items"  ("sellerOrderId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."seller_orders_status_enum" AS ENUM('AWAITING_FULFILLMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "seller_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "orderId" uuid NOT NULL, "sellerProfileId" uuid NOT NULL, "subtotal" numeric(12,2) NOT NULL, "commissionAmount" numeric(12,2) NOT NULL, "sellerNetAmount" numeric(12,2) NOT NULL, "status" "public"."seller_orders_status_enum" NOT NULL DEFAULT 'AWAITING_FULFILLMENT', CONSTRAINT "PK_ad51e1ce24eed4fbd4f48d94985" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_78e80ca401cdbe1c8ec4797455" ON "seller_orders"  ("orderId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9e0e920ddfc0bf70110e0ae77d" ON "seller_orders"  ("sellerProfileId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_status_enum" AS ENUM('PENDING_PAYMENT', 'PAID', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "buyerId" uuid NOT NULL, "totalAmount" numeric(12,2) NOT NULL, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'PENDING_PAYMENT', "shippingAddressLine1" character varying, "shippingAddressLine2" character varying, "shippingCity" character varying, "shippingPostalCode" character varying, "shippingCountry" character varying, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9877ffd9a491c3e82f5b32d4f4" ON "orders"  ("buyerId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "bids" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "auctionId" uuid NOT NULL, "bidderId" uuid NOT NULL, "amount" numeric(12,2) NOT NULL, CONSTRAINT "PK_7950d066d322aab3a488ac39fe5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6d6b20987ed2f61e8801398f8d" ON "bids"  ("auctionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fe34abd3aeb153efaea7a03c67" ON "bids"  ("bidderId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."auctions_status_enum" AS ENUM('SCHEDULED', 'ACTIVE', 'ENDED', 'AWAITING_PAYMENT', 'COMPLETED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "auctions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "productId" uuid NOT NULL, "startPrice" numeric(12,2) NOT NULL, "currentPrice" numeric(12,2) NOT NULL, "minBidIncrement" numeric(12,2) NOT NULL, "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL, "endsAt" TIMESTAMP WITH TIME ZONE NOT NULL, "winnerId" uuid, "purchaseWindowEndsAt" TIMESTAMP WITH TIME ZONE, "status" "public"."auctions_status_enum" NOT NULL DEFAULT 'SCHEDULED', "version" integer NOT NULL, CONSTRAINT "PK_87d2b34d4829f0519a5c5570368" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1e69bf3176e83fc48ac6ffc6f9" ON "auctions"  ("productId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_entries_type_enum" AS ENUM('SALE_CREDIT', 'COMMISSION_DEBIT', 'REFUND_DEBIT', 'PAYOUT_DEBIT', 'ADJUSTMENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ledger_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sellerProfileId" uuid NOT NULL, "type" "public"."ledger_entries_type_enum" NOT NULL, "amount" numeric(12,2) NOT NULL, "sellerOrderId" uuid, "description" character varying, CONSTRAINT "PK_6efcb84411d3f08b08450ae75d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_295e835bdc3cf0215fbffe1a85" ON "ledger_entries"  ("sellerProfileId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "productId" uuid NOT NULL, "authorId" uuid NOT NULL, "orderId" uuid, "rating" smallint NOT NULL, "comment" text, CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a917d8a850b61f4cb2950594d5" ON "reviews"  ("productId", "authorId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."disputes_status_enum" AS ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "disputes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sellerOrderId" uuid NOT NULL, "raisedByUserId" uuid NOT NULL, "reason" text NOT NULL, "status" "public"."disputes_status_enum" NOT NULL DEFAULT 'OPEN', "resolvedByUserId" uuid, "resolutionNotes" text, "resolvedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_3c97580d01c1a4b0b345c42a107" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8b6ae5eb60e7aa10ef063831a9" ON "disputes"  ("sellerOrderId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refunds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sellerOrderId" uuid NOT NULL, "disputeId" uuid, "amount" numeric(12,2) NOT NULL, "reason" text, "processedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_5106efb01eeda7e49a78b869738" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5bfc925761ad38b4a1f0c91ced" ON "refunds"  ("sellerOrderId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."outbox_events_status_enum" AS ENUM('PENDING', 'PUBLISHED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "outbox_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "eventType" character varying NOT NULL, "aggregateType" character varying NOT NULL, "aggregateId" uuid NOT NULL, "payload" jsonb NOT NULL, "correlationId" uuid NOT NULL, "publishedAt" TIMESTAMP WITH TIME ZONE, "status" "public"."outbox_events_status_enum" NOT NULL DEFAULT 'PENDING', "attempts" integer NOT NULL DEFAULT '0', "lastError" text, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a24c3217a29817c76d4f7403c5" ON "outbox_events"  ("aggregateId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_af70752e536801c85ac463c468" ON "outbox_events"  ("correlationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e10d0e4896a0f24c546f88b84f" ON "outbox_events"  ("status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "processed_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "consumerName" character varying NOT NULL, "outboxEventId" uuid NOT NULL, "processedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a08d68aa0747daea9efd2ddea53" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3811bc4821ead31fb05adcbc9d" ON "processed_events"  ("consumerName", "outboxEventId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_profiles" ADD CONSTRAINT "FK_49de7dde25d76b120677be9aedd" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_applications" ADD CONSTRAINT "FK_bc16b54496faa4ffae868a999ce" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_c2362430f78a82f97fec8ab2ec9" FOREIGN KEY ("sellerProfileId") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_ff56834e735fa78a15d0cf21926" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "FK_edd714311619a5ad09525045838" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "FK_72679d98b31c737937b8932ebe6" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "carts" ADD CONSTRAINT "FK_69828a178f152f157dcf2f70a89" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_order_items" ADD CONSTRAINT "FK_8ba1c26f21384a93acb94ab738c" FOREIGN KEY ("sellerOrderId") REFERENCES "seller_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_order_items" ADD CONSTRAINT "FK_d78e8299db1f3584ed583f41e36" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_orders" ADD CONSTRAINT "FK_78e80ca401cdbe1c8ec47974554" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_orders" ADD CONSTRAINT "FK_9e0e920ddfc0bf70110e0ae77d7" FOREIGN KEY ("sellerProfileId") REFERENCES "seller_profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_9877ffd9a491c3e82f5b32d4f4d" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bids" ADD CONSTRAINT "FK_6d6b20987ed2f61e8801398f8d1" FOREIGN KEY ("auctionId") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bids" ADD CONSTRAINT "FK_fe34abd3aeb153efaea7a03c676" FOREIGN KEY ("bidderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" ADD CONSTRAINT "FK_1e69bf3176e83fc48ac6ffc6f93" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" ADD CONSTRAINT "FK_cc190079f877df0ca02c99f1be4" FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" ADD CONSTRAINT "FK_295e835bdc3cf0215fbffe1a857" FOREIGN KEY ("sellerProfileId") REFERENCES "seller_profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_a6b3c434392f5d10ec171043666" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_48770372f891b9998360e4434f3" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_53a68dc905777554b7f702791fa" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_8b6ae5eb60e7aa10ef063831a92" FOREIGN KEY ("sellerOrderId") REFERENCES "seller_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_747b43fbe9acdac10fd4bf41492" FOREIGN KEY ("raisedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD CONSTRAINT "FK_5bfc925761ad38b4a1f0c91ced6" FOREIGN KEY ("sellerOrderId") REFERENCES "seller_orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD CONSTRAINT "FK_6295fee8a80f7688d0d023faae4" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refunds" DROP CONSTRAINT "FK_6295fee8a80f7688d0d023faae4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" DROP CONSTRAINT "FK_5bfc925761ad38b4a1f0c91ced6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT "FK_747b43fbe9acdac10fd4bf41492"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT "FK_8b6ae5eb60e7aa10ef063831a92"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_53a68dc905777554b7f702791fa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_48770372f891b9998360e4434f3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_a6b3c434392f5d10ec171043666"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entries" DROP CONSTRAINT "FK_295e835bdc3cf0215fbffe1a857"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" DROP CONSTRAINT "FK_cc190079f877df0ca02c99f1be4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auctions" DROP CONSTRAINT "FK_1e69bf3176e83fc48ac6ffc6f93"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bids" DROP CONSTRAINT "FK_fe34abd3aeb153efaea7a03c676"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bids" DROP CONSTRAINT "FK_6d6b20987ed2f61e8801398f8d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_9877ffd9a491c3e82f5b32d4f4d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_orders" DROP CONSTRAINT "FK_9e0e920ddfc0bf70110e0ae77d7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_orders" DROP CONSTRAINT "FK_78e80ca401cdbe1c8ec47974554"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_order_items" DROP CONSTRAINT "FK_d78e8299db1f3584ed583f41e36"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_order_items" DROP CONSTRAINT "FK_8ba1c26f21384a93acb94ab738c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "carts" DROP CONSTRAINT "FK_69828a178f152f157dcf2f70a89"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT "FK_72679d98b31c737937b8932ebe6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT "FK_edd714311619a5ad09525045838"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_ff56834e735fa78a15d0cf21926"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_c2362430f78a82f97fec8ab2ec9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_applications" DROP CONSTRAINT "FK_bc16b54496faa4ffae868a999ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seller_profiles" DROP CONSTRAINT "FK_49de7dde25d76b120677be9aedd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3811bc4821ead31fb05adcbc9d"`,
    );
    await queryRunner.query(`DROP TABLE "processed_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e10d0e4896a0f24c546f88b84f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_af70752e536801c85ac463c468"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a24c3217a29817c76d4f7403c5"`,
    );
    await queryRunner.query(`DROP TABLE "outbox_events"`);
    await queryRunner.query(`DROP TYPE "public"."outbox_events_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5bfc925761ad38b4a1f0c91ced"`,
    );
    await queryRunner.query(`DROP TABLE "refunds"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8b6ae5eb60e7aa10ef063831a9"`,
    );
    await queryRunner.query(`DROP TABLE "disputes"`);
    await queryRunner.query(`DROP TYPE "public"."disputes_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a917d8a850b61f4cb2950594d5"`,
    );
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_295e835bdc3cf0215fbffe1a85"`,
    );
    await queryRunner.query(`DROP TABLE "ledger_entries"`);
    await queryRunner.query(`DROP TYPE "public"."ledger_entries_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1e69bf3176e83fc48ac6ffc6f9"`,
    );
    await queryRunner.query(`DROP TABLE "auctions"`);
    await queryRunner.query(`DROP TYPE "public"."auctions_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fe34abd3aeb153efaea7a03c67"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6d6b20987ed2f61e8801398f8d"`,
    );
    await queryRunner.query(`DROP TABLE "bids"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9877ffd9a491c3e82f5b32d4f4"`,
    );
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9e0e920ddfc0bf70110e0ae77d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_78e80ca401cdbe1c8ec4797455"`,
    );
    await queryRunner.query(`DROP TABLE "seller_orders"`);
    await queryRunner.query(`DROP TYPE "public"."seller_orders_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8ba1c26f21384a93acb94ab738"`,
    );
    await queryRunner.query(`DROP TABLE "seller_order_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_69828a178f152f157dcf2f70a8"`,
    );
    await queryRunner.query(`DROP TABLE "carts"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2bf7996b7946ce753b60a87468"`,
    );
    await queryRunner.query(`DROP TABLE "cart_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_464f927ae360106b783ed0b410"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ff56834e735fa78a15d0cf2192"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c2362430f78a82f97fec8ab2ec"`,
    );
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TYPE "public"."products_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_420d9f679d41281f282f5bc7d0"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bc16b54496faa4ffae868a999c"`,
    );
    await queryRunner.query(`DROP TABLE "seller_applications"`);
    await queryRunner.query(
      `DROP TYPE "public"."seller_applications_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c25bc63d248ca90e8dcc1d92d0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_610102b60fea1455310ccd299d"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_64d97ba7c48919953474c6d69e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_021884245647d067661df78931"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_49de7dde25d76b120677be9aed"`,
    );
    await queryRunner.query(`DROP TABLE "seller_profiles"`);
  }
}
