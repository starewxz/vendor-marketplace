import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { HealthCheckResult } from '@nestjs/terminus';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  correlationId: string;
  timestamp: string;
}

/**
 * Terminus (`HealthCheckService.check()`) throws `ServiceUnavailableException`
 * with the full `{ status, info, error, details }` result object as the raw
 * exception response — not a `{ message }` string like a normal HttpException.
 * Detecting that shape structurally (rather than matching on the `/health`
 * route) means this survives the health endpoint moving, while a plain
 * `throw new ServiceUnavailableException('...')` elsewhere in the app — whose
 * response is the standard Nest `{ statusCode, message, error }` shape and
 * has no `details` key — still goes through the normal standardized format
 * below.
 */
function isTerminusHealthCheckResult(
  value: unknown,
): value is HealthCheckResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { status?: unknown }).status === 'string' &&
    typeof (value as { details?: unknown }).details === 'object'
  );
}

/**
 * Normalizes every thrown error (HttpException or otherwise) into a single
 * predictable JSON shape, and always echoes the correlation ID so clients and
 * logs can be cross-referenced. The one deliberate exception is Terminus'
 * own health-check payload (see `isTerminusHealthCheckResult`), which is
 * preserved verbatim so /health failures keep their per-component detail.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode: number = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;

    if (statusCode >= 500) {
      this.logger.error(
        `[${request.correlationId}] ${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    if (isTerminusHealthCheckResult(exceptionResponse)) {
      response.status(statusCode).json(exceptionResponse);
      return;
    }

    const message = this.extractMessage(exceptionResponse, exception);
    const error = isHttpException ? exception.name : 'InternalServerError';

    const body: ErrorResponseBody = {
      statusCode,
      message,
      error,
      path: request.url,
      correlationId: request.correlationId,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  private extractMessage(
    exceptionResponse: string | object | null,
    exception: unknown,
  ): string | string[] {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }
    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      return (exceptionResponse as { message: string | string[] }).message;
    }
    if (exception instanceof Error) {
      return exception.message;
    }
    return 'Internal server error';
  }
}
