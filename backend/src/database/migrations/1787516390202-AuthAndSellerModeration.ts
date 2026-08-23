import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthAndSellerModeration1787516390202 implements MigrationInterface {
  name = 'AuthAndSellerModeration1787516390202';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."auth_identities_provider_enum" AS ENUM('LOCAL', 'GOOGLE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_identities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "provider" "public"."auth_identities_provider_enum" NOT NULL, "providerUserId" character varying NOT NULL, CONSTRAINT "PK_63a29aebcddd09448dbeee4666b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6ed26ac7e2276ae145ca68c23a" ON "auth_identities"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e2afaeac776db523ee689bfdf9" ON "auth_identities"  ("provider", "providerUserId") `,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "googleId"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_seller_applications_one_pending_per_user" ON "seller_applications"  ("userId") WHERE "status" = 'PENDING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_identities" ADD CONSTRAINT "FK_6ed26ac7e2276ae145ca68c23af" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_identities" DROP CONSTRAINT "FK_6ed26ac7e2276ae145ca68c23af"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_seller_applications_one_pending_per_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "googleId" character varying`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e2afaeac776db523ee689bfdf9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6ed26ac7e2276ae145ca68c23a"`,
    );
    await queryRunner.query(`DROP TABLE "auth_identities"`);
    await queryRunner.query(
      `DROP TYPE "public"."auth_identities_provider_enum"`,
    );
  }
}
