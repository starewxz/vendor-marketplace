import { MetricsRegistryService } from './metrics-registry.service';

/**
 * Times a queue job handler and records queue_processing_duration_seconds
 * plus queue_jobs_processed_total/queue_jobs_failed_total, regardless of
 * outcome. Rethrows so the caller's own retry/backoff logic still runs.
 */
export async function recordQueueJob<T>(
  metrics: MetricsRegistryService,
  fn: () => Promise<T>,
): Promise<T> {
  const start = process.hrtime.bigint();
  try {
    const result = await fn();
    metrics.observe(
      'queue_processing_duration_seconds',
      Number(process.hrtime.bigint() - start) / 1_000_000_000,
    );
    metrics.increment('queue_jobs_processed_total');
    return result;
  } catch (error) {
    metrics.observe(
      'queue_processing_duration_seconds',
      Number(process.hrtime.bigint() - start) / 1_000_000_000,
    );
    metrics.increment('queue_jobs_failed_total');
    throw error;
  }
}
