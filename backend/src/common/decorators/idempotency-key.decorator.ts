import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Reads the `Idempotency-Key` header. Presence/format validation happens in
 * the consuming service, not here, so the error message can be specific to
 * what the operation requires.
 */
export const IdempotencyKeyHeader = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const header = request.headers['idempotency-key'];
    return Array.isArray(header) ? header[0] : header;
  },
);
