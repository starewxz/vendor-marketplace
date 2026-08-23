import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

declare module 'express' {
  interface Request {
    correlationId: string;
  }
}

/**
 * Assigns a correlation ID to every request: reuses an inbound header if the
 * caller already has one (e.g. a service-to-service call), otherwise mints a
 * new one. This ID is the seed that later stages propagate into outbox
 * events, BullMQ job data, and async log lines so a single request can be
 * traced end-to-end.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header(CORRELATION_ID_HEADER);
    const correlationId =
      incoming && incoming.trim().length > 0 ? incoming : randomUUID();

    req.correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
