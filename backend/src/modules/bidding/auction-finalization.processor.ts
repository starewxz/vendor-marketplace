import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { AuctionFinalizationJobData } from './auction-finalization.types';
import { AuctionLifecycleService } from './auction-lifecycle.service';
import { MetricsRegistryService } from '../metrics/metrics-registry.service';
import { recordQueueJob } from '../metrics/queue-metrics.util';

/**
 * Consumer side of the two delayed triggers AuctionLifecycleService
 * schedules: FINALIZE at an auction's endsAt, EXPIRE_PURCHASE_WINDOW at its
 * purchaseWindowEndsAt. No ProcessedEvent dedup table here (unlike
 * SellerOrderProcessingProcessor) — finalizeAuction/expirePurchaseWindow
 * are already idempotent on their own (locked, status-checked no-ops), so a
 * redelivered job or one that races AuctionReconciliationService's sweep is
 * naturally harmless without needing a separate dedup record.
 */
@Processor(QUEUE_NAMES.AUCTION_FINALIZATION)
export class AuctionFinalizationProcessor extends WorkerHost {
  private readonly logger = new Logger(AuctionFinalizationProcessor.name);

  constructor(
    private readonly lifecycle: AuctionLifecycleService,
    private readonly metrics: MetricsRegistryService,
  ) {
    super();
  }

  async process(job: Job<AuctionFinalizationJobData>): Promise<void> {
    const { type, auctionId, correlationId } = job.data;
    this.logger.log(
      `[${correlationId}] auction finalization job started type=${type} auctionId=${auctionId}`,
    );
    try {
      await recordQueueJob(this.metrics, async () => {
        if (type === 'FINALIZE') {
          await this.lifecycle.finalizeAuction(auctionId, correlationId);
        } else {
          await this.lifecycle.expirePurchaseWindow(auctionId, correlationId);
        }
      });
      this.logger.log(
        `[${correlationId}] auction finalization job completed type=${type} auctionId=${auctionId}`,
      );
    } catch (error) {
      this.logger.error(
        `[${correlationId}] auction finalization job failed type=${type} auctionId=${auctionId} (attempt ${job.attemptsMade + 1}): ${(error as Error).message}`,
      );
      throw error; // rethrow so BullMQ applies the configured retry/backoff
    }
  }
}
