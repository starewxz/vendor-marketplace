import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DlqModule } from './dlq.module';
import { DeadLetterService } from '../modules/outbox/dead-letter.service';
import { DeadLetterStatus } from '../modules/outbox/entities/dead-letter-status.enum';

/**
 * `npm run dlq:list [-- STATUS]` — lists dead-letter entries, most recent
 * first. STATUS is optional (PENDING/REPLAYING/REPLAYED/REPLAY_FAILED);
 * omit it to list everything.
 */
async function main() {
  const statusArg = process.argv[2]?.toUpperCase();
  let status: DeadLetterStatus | undefined;
  if (statusArg) {
    if (
      !Object.values(DeadLetterStatus).includes(statusArg as DeadLetterStatus)
    ) {
      console.error(
        `Unknown status "${statusArg}". Expected one of: ${Object.values(DeadLetterStatus).join(', ')}`,
      );
      process.exitCode = 1;
      return;
    }
    status = statusArg as DeadLetterStatus;
  }

  const app = await NestFactory.createApplicationContext(DlqModule, {
    logger: ['error', 'warn'],
  });

  try {
    const deadLetter = app.get(DeadLetterService);
    const entries = await deadLetter.list(status);

    if (entries.length === 0) {
      console.log(
        status
          ? `No dead-letter entries with status ${status}.`
          : 'No dead-letter entries.',
      );
      return;
    }

    console.log(
      `${entries.length} dead-letter entr${entries.length === 1 ? 'y' : 'ies'}:\n`,
    );
    for (const entry of entries) {
      console.log(
        [
          `id=${entry.id}`,
          `status=${entry.status}`,
          `queue=${entry.originalQueue}`,
          `eventType=${entry.eventType}`,
          `outboxEventId=${entry.outboxEventId ?? '-'}`,
          `attemptsMade=${entry.attemptsMade}`,
          `failedAt=${entry.failedAt.toISOString()}`,
          `correlationId=${entry.correlationId}`,
        ].join('  '),
      );
      console.log(`  reason: ${entry.failureReason}`);
    }
    console.log(`\nReplay one with: npm run dlq:replay -- <id>`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('dlq:list failed:', error);
  process.exitCode = 1;
});
