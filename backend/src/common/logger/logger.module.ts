import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { Request, Response } from 'express';
import { AppConfig } from '../config/configuration';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

/**
 * Reads the correlation ID set by CorrelationIdMiddleware. Falls back to the
 * inbound header (or a fresh UUID) so log correlation still works regardless
 * of Express middleware ordering between modules.
 */
function resolveCorrelationId(req: Request): string {
  return req.correlationId ?? req.header(CORRELATION_ID_HEADER) ?? randomUUID();
}

/**
 * Structured JSON logging (pino) with the correlation ID attached to every
 * log line for a request. In development, output is pretty-printed; in
 * production it stays newline-delimited JSON for log aggregators.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const nodeEnv = configService.get('nodeEnv', { infer: true });
        const logLevel = configService.get('logLevel', { infer: true });
        const isDev = nodeEnv !== 'production';

        return {
          pinoHttp: {
            level: logLevel,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
            transport: isDev
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
            genReqId: (req: Request) => resolveCorrelationId(req),
            customProps: (req: Request) => ({
              correlationId: resolveCorrelationId(req),
            }),
            customSuccessMessage: (req: Request, res: Response) =>
              `${req.method} ${req.url} -> ${res.statusCode}`,
            autoLogging: {
              ignore: (req: Request) => req.url === '/api/health',
            },
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
