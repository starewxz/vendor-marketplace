import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { MetricsRegistryService } from './metrics-registry.service';

/**
 * Runtime process metrics plus business/domain counters (checkout, stock,
 * idempotency — see MetricsRegistryService) in Prometheus text format.
 */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly registry: MetricsRegistryService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  getMetrics(): string {
    const memory = process.memoryUsage();
    const processMetrics = [
      '# HELP process_uptime_seconds Process uptime in seconds.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime()}`,
      '# HELP process_resident_memory_bytes Resident memory size in bytes.',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${memory.rss}`,
      '# HELP process_heap_used_bytes Heap memory used in bytes.',
      '# TYPE process_heap_used_bytes gauge',
      `process_heap_used_bytes ${memory.heapUsed}`,
      '',
    ].join('\n');

    return processMetrics + this.registry.renderPrometheusText();
  }
}
