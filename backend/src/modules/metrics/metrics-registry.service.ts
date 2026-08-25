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
const DEFAULT_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

interface HistogramState {
  buckets: number[];
  bucketCounts: number[];
  sum: number;
  count: number;
}

@Injectable()
export class MetricsRegistryService {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly histograms = new Map<string, HistogramState>();

  increment(name: string, amount = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  incrementGauge(name: string, amount = 1): void {
    this.gauges.set(name, Math.max(0, (this.gauges.get(name) ?? 0) + amount));
  }

  /** Records a duration (in seconds) into a fixed-bucket histogram. */
  observe(
    name: string,
    valueSeconds: number,
    buckets: number[] = DEFAULT_BUCKETS_SECONDS,
  ): void {
    let state = this.histograms.get(name);
    if (!state) {
      state = {
        buckets,
        bucketCounts: new Array<number>(buckets.length).fill(0),
        sum: 0,
        count: 0,
      };
      this.histograms.set(name, state);
    }
    for (let i = 0; i < state.buckets.length; i += 1) {
      if (valueSeconds <= state.buckets[i]) state.bucketCounts[i] += 1;
    }
    state.sum += valueSeconds;
    state.count += 1;
  }

  renderPrometheusText(): string {
    const lines: string[] = [];
    for (const [name, value] of this.counters) {
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }
    for (const [name, value] of this.gauges) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }
    for (const [name, state] of this.histograms) {
      lines.push(`# TYPE ${name} histogram`);
      let cumulative = 0;
      for (let i = 0; i < state.buckets.length; i += 1) {
        cumulative = state.bucketCounts[i];
        lines.push(`${name}_bucket{le="${state.buckets[i]}"} ${cumulative}`);
      }
      lines.push(`${name}_bucket{le="+Inf"} ${state.count}`);
      lines.push(`${name}_sum ${state.sum}`);
      lines.push(`${name}_count ${state.count}`);
    }
    return lines.length > 0 ? lines.join('\n') + '\n' : '';
  }
}
