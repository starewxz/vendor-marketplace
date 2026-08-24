import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsRegistryService } from './metrics-registry.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsRegistryService],
  exports: [MetricsRegistryService],
})
export class MetricsModule {}
