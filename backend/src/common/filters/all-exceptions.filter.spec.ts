/* eslint-disable @typescript-eslint/no-unsafe-member-access -- jest.fn().mock.calls is untyped */
import {
  ArgumentsHost,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HealthCheckResult } from '@nestjs/terminus';
import { AllExceptionsFilter } from './all-exceptions.filter';

function buildHost(): {
  host: ArgumentsHost;
  json: jest.Mock;
  status: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        url: '/api/health',
        method: 'GET',
        correlationId: 'test-correlation-id',
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
}

describe('AllExceptionsFilter', () => {
  it('preserves the Terminus health-check payload verbatim on a degraded /health response', () => {
    const filter = new AllExceptionsFilter();
    const { host, json, status } = buildHost();

    const terminusResult: HealthCheckResult = {
      status: 'error',
      info: { postgres: { status: 'up' }, redis: { status: 'up' } },
      error: {
        meilisearch: { status: 'down', message: 'connect ECONNREFUSED' },
      },
      details: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
        meilisearch: { status: 'down', message: 'connect ECONNREFUSED' },
      },
    };

    filter.catch(new ServiceUnavailableException(terminusResult), host);

    expect(status).toHaveBeenCalledWith(503);
    // The raw Terminus shape must survive unchanged — no statusCode/error/
    // correlationId/path wrapper collapsing it into the generic shape.
    expect(json).toHaveBeenCalledWith(terminusResult);
    const body = json.mock.calls[0][0] as HealthCheckResult;
    expect(body.details.postgres.status).toBe('up');
    expect(body.details.redis.status).toBe('up');
    expect(body.details.meilisearch.status).toBe('down');
    expect(body).not.toHaveProperty('statusCode');
    expect(body).not.toHaveProperty('correlationId');
  });

  it('still uses the standard error shape for a plain (non-Terminus) ServiceUnavailableException', () => {
    const filter = new AllExceptionsFilter();
    const { host, json, status } = buildHost();

    filter.catch(
      new ServiceUnavailableException('downstream provider unreachable'),
      host,
    );

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        message: 'downstream provider unreachable',
        error: 'ServiceUnavailableException',
        path: '/api/health',
        correlationId: 'test-correlation-id',
      }),
    );
  });

  it('still uses the standard error shape for an unrelated HttpException', () => {
    const filter = new AllExceptionsFilter();
    const { host, json, status } = buildHost();

    filter.catch(new NotFoundException('Product not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Product not found',
        error: 'NotFoundException',
      }),
    );
  });
});
