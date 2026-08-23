import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  let controller: MetricsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
    }).compile();

    controller = module.get(MetricsController);
  });

  it('exposes process metrics in Prometheus text format', () => {
    const output = controller.getMetrics();
    expect(output).toContain('process_uptime_seconds');
    expect(output).toContain('process_resident_memory_bytes');
  });
});
