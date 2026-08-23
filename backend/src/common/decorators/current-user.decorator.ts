import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import type { AuthenticatedRequestUser } from '../../modules/auth/types/jwt-payload';

/**
 * Injects the authenticated user derived from the verified JWT (set by
 * JwtAuthGuard). Always prefer this over trusting a userId/sellerId from the
 * request body or params — see README "Ownership" note.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedRequestUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthenticatedRequestUser;
  },
);
