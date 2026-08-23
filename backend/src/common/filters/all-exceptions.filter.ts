import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
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
 * Normalizes every thrown error (HttpException or otherwise) into a single
 * predictable JSON shape, and always echoes the correlation ID so clients and
 * logs can be cross-referenced.
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

    if (statusCode >= 500) {
      this.logger.error(
        `[${request.correlationId}] ${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

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
