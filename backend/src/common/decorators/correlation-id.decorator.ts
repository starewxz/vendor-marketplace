import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Injects the current request's correlation ID into a controller handler.
 * Usage: `handler(@CorrelationId() correlationId: string)`
 */
export const CorrelationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.correlationId;
  },
);
