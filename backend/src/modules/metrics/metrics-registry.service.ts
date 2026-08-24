import { Injectable } from '@nestjs/common';

/**
 * In-process counter registry, rendered as Prometheus text by
 * MetricsController alongside the existing process metrics. Deliberately
 * not backed by prom-client — this stage only needs a handful of simple
 * monotonic counters, and the existing /metrics endpoint already hand-rolls
 * its output in the same format.
 *
 * Per-process, not cross-instance: fine for this stage's purpose (a
 * lightweight signal for checkout/stock/idempotency activity), not a
 * replacement for a real metrics backend in a multi-instance deployment.
 */
@Injectable()
export class MetricsRegistryService {
  private readonly counters = new Map<string, number>();

  increment(name: string, amount = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }

  renderPrometheusText(): string {
    const lines: string[] = [];
    for (const [name, value] of this.counters) {
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }
    return lines.length > 0 ? lines.join('\n') + '\n' : '';
  }
}
