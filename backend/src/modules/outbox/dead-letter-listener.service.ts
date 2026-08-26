import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueEvents } from 'bullmq';
import { AppConfig } from '../../common/config/configuration';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { DeadLetterService } from './dead-letter.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';

const MONITORED_QUEUES: string[] = [
  QUEUE_NAMES.SEARCH_SYNC,
  QUEUE_NAMES.SELLER_ORDER_PROCESSING,
  QUEUE_NAMES.NOTIFICATIONS,
  QUEUE_NAMES.REALTIME,
  QUEUE_NAMES.AUCTION_FINALIZATION,
];

/**
 * Detects when a BullMQ job has permanently exhausted its retries (as
 * opposed to a `failed` event for an attempt that will still retry) and
 * routes it into the dead-letter table. Deliberately a standalone
 * `QueueEvents`-based listener rather than an `@OnWorkerEvent` hook added
 * to each of the 5 existing processors — this is Redis-pub/sub-driven and
 * queue-name-scoped, so it needs zero changes to the processors'
 * business-logic files and works the same whether the worker that ran the
 * job lives in this process or another instance.
 *
 * Also tracks the outcome of a replay: if a replayed job later completes
 * or fails-again, the matching REPLAYING dead-letter row (found by
 * (queue, outboxEventId), not by parsing the replay jobId) is updated to
 * REPLAYED or REPLAY_FAILED accordingly, instead of leaving it stuck.
 */
@Injectable()
export class DeadLetterListenerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DeadLetterListenerService.name);
  private readonly queueEvents: QueueEvents[] = [];
  private readonly redisUrl: string;

  constructor(
    private readonly deadLetter: DeadLetterService,
    private readonly metrics: MetricsRegistryService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.redisUrl = configService.get('redis.url', { infer: true });
  }

  onModuleInit(): void {
    for (const queueName of MONITORED_QUEUES) {
      const events = new QueueEvents(queueName, {
        connection: { url: this.redisUrl, maxRetriesPerRequest: null },
      });
      events.on('failed', ({ jobId, failedReason }) => {
        this.handleFailed(queueName, jobId, failedReason).catch((error) => {
          this.logger.error(
            `dead-letter failed-event handling errored queue=${queueName} jobId=${jobId}: ${(error as Error).message}`,
          );
        });
      });
      events.on('completed', ({ jobId }) => {
        this.handleCompleted(queueName, jobId).catch((error) => {
          this.logger.error(
            `dead-letter completed-event handling errored queue=${queueName} jobId=${jobId}: ${(error as Error).message}`,
          );
        });
      });
      this.queueEvents.push(events);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.queueEvents.map((events) => events.close()));
  }

  private async handleFailed(
    queueName: string,
    jobId: string,
    failedReason: string,
  ): Promise<void> {
    const queue = this.deadLetter.getQueue(queueName);
    const job = await queue?.getJob(jobId);
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    // job.finishedOn is only set once BullMQ decides there's no more retry
    // to schedule (see Job.moveToFailed) — attemptsMade alone can't
    // distinguish "about to retry" from "just gave up" at this instant.
    const exhausted = job.finishedOn != null && job.attemptsMade >= maxAttempts;
    if (!exhausted) return;

    const data = (job.data ?? {}) as Record<string, unknown>;
    const outboxEventId =
      typeof data.outboxEventId === 'string' ? data.outboxEventId : null;
    const correlationId =
      typeof data.correlationId === 'string' ? data.correlationId : jobId;

    if (outboxEventId) {
      const replaying = await this.deadLetter.findReplayingByOutboxEventId(
        queueName,
        outboxEventId,
      );
      if (replaying) {
        await this.deadLetter.markReplayFailed(replaying.id);
        this.logger.error(
          `[${correlationId}] dead-letter replay failed again deadLetterId=${replaying.id} queue=${queueName} jobId=${jobId} attemptsMade=${job.attemptsMade}`,
        );
        return;
      }
    }

    await this.deadLetter.record({
      originalQueue: queueName,
      jobId,
      outboxEventId,
      eventType: typeof data.eventType === 'string' ? data.eventType : job.name,
      aggregateType:
        typeof data.aggregateType === 'string' ? data.aggregateType : null,
      aggregateId:
        typeof data.aggregateId === 'string' ? data.aggregateId : null,
      payload: data,
      attemptsMade: job.attemptsMade,
      failureReason: failedReason,
      correlationId,
    });
  }

  private async handleCompleted(
    queueName: string,
    jobId: string,
  ): Promise<void> {
    const queue = this.deadLetter.getQueue(queueName);
    const job = await queue?.getJob(jobId);
    if (!job) return;

    const data = (job.data ?? {}) as Record<string, unknown>;
    const outboxEventId =
      typeof data.outboxEventId === 'string' ? data.outboxEventId : null;
    if (!outboxEventId) return;

    const replaying = await this.deadLetter.findReplayingByOutboxEventId(
      queueName,
      outboxEventId,
    );
    if (!replaying) return;

    await this.deadLetter.markReplayed(replaying.id);
    this.metrics.increment('queue_replay_succeeded_total');
    this.logger.log(
      `[${replaying.correlationId}] dead-letter replay succeeded deadLetterId=${replaying.id} queue=${queueName} jobId=${jobId}`,
    );
  }
}
