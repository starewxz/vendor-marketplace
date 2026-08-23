import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Runtime process metrics in Prometheus text format. Business/domain
 * counters (orders processed, bids placed, etc.) are added per-module as
 * those flows are implemented, using this same registry pattern.
 */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  getMetrics(): string {
    const memory = process.memoryUsage();
    return [
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
  }
}
