import { Request, Response } from 'express';
import {
  CORRELATION_ID_HEADER,
  CorrelationIdMiddleware,
} from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  function mockRequest(headers: Record<string, string> = {}): Request {
    return {
      header: (name: string) => headers[name.toLowerCase()],
    } as unknown as Request;
  }

  function mockResponse(): Response {
    const headers: Record<string, string> = {};
    return {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      getHeader: (name: string) => headers[name],
    } as unknown as Response;
  }

  it('mints a new correlation ID when none is supplied', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBeDefined();
    expect(req.correlationId).toHaveLength(36);
    expect(res.getHeader(CORRELATION_ID_HEADER)).toBe(req.correlationId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses an inbound correlation ID header', () => {
    const inboundId = 'existing-correlation-id';
    const req = mockRequest({ [CORRELATION_ID_HEADER]: inboundId });
    const res = mockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBe(inboundId);
    expect(res.getHeader(CORRELATION_ID_HEADER)).toBe(inboundId);
  });

  it('generates a new ID when the inbound header is blank', () => {
    const req = mockRequest({ [CORRELATION_ID_HEADER]: '   ' });
    const res = mockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.correlationId.trim()).toBe(req.correlationId);
    expect(req.correlationId).not.toBe('   ');
  });
});
