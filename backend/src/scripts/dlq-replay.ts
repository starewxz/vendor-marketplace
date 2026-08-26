import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DlqModule } from './dlq.module';
import { DeadLetterService } from '../modules/outbox/dead-letter.service';

/**
 * `npm run dlq:replay -- <id>` — re-enqueues a dead-lettered job's original
 * payload into its original queue. Safe to run more than once for the same
 * id (or after a previous replay already succeeded): the consumer's own
 * ProcessedEvent check is what guarantees no duplicate business effect, not
 * this command. This only confirms the replay was *enqueued* — check
 * `npm run dlq:list` afterward (or the logs / queue_replay_* metrics) for
 * whether it actually completed.
 */
async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: npm run dlq:replay -- <dead-letter-id>');
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(DlqModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const deadLetter = app.get(DeadLetterService);
    const entry = await deadLetter.replay(id);
    console.log(
      `Replay enqueued: id=${entry.id} queue=${entry.originalQueue} eventType=${entry.eventType} status=${entry.status}`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('dlq:replay failed:', error);
  process.exitCode = 1;
});
