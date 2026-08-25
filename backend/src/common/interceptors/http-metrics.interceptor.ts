import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsRegistryService } from '../../modules/metrics/metrics-registry.service';

/** Records every HTTP request's duration into http_request_duration_seconds. */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsRegistryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const start = process.hrtime.bigint();
    const record = () => {
      const elapsedSeconds =
        Number(process.hrtime.bigint() - start) / 1_000_000_000;
      this.metrics.observe('http_request_duration_seconds', elapsedSeconds);
    };
    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
