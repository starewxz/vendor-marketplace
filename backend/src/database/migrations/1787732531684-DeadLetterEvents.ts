import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dead-letter table for jobs/events that exhaust every BullMQ retry
 * attempt — see DeadLetterListenerService / DeadLetterService. Mirrors the
 * outbox_events / processed_events table style from the initial schema.
 */
export class DeadLetterEvents1787732531684 implements MigrationInterface {
  name = 'DeadLetterEvents1787732531684';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."dead_letter_events_status_enum" AS ENUM('PENDING', 'REPLAYING', 'REPLAYED', 'REPLAY_FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "dead_letter_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "originalQueue" character varying NOT NULL,
        "jobId" character varying NOT NULL,
        "outboxEventId" uuid,
        "eventType" character varying NOT NULL,
        "aggregateType" character varying,
        "aggregateId" character varying,
        "payload" jsonb NOT NULL,
        "attemptsMade" integer NOT NULL,
        "failureReason" text NOT NULL,
        "correlationId" uuid NOT NULL,
        "failedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" "public"."dead_letter_events_status_enum" NOT NULL DEFAULT 'PENDING',
        "replayedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_dead_letter_events" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_dead_letter_events_queue_job" ON "dead_letter_events" ("originalQueue", "jobId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dead_letter_events_status_created" ON "dead_letter_events" ("status", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dead_letter_events_outbox_event" ON "dead_letter_events" ("outboxEventId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dead_letter_events_correlation" ON "dead_letter_events" ("correlationId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "dead_letter_events"`);
    await queryRunner.query(
      `DROP TYPE "public"."dead_letter_events_status_enum"`,
    );
  }
}
