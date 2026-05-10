import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { requestIdMiddleware } from '../src/middlewares/request-id.middleware';

const createResponseMock = (): Response => {
  const res = {} as Response;
  res.setHeader = jest.fn();
  return res;
};

describe('requestIdMiddleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses trimmed x-request-id header when provided', () => {
    const req = {
      get: jest.fn().mockImplementation((name: string) =>
        name.toLowerCase() === 'x-request-id' ? '  custom-request-id  ' : undefined
      )
    } as unknown as Request;
    const res = createResponseMock();
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe('custom-request-id');
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'custom-request-id'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates request id when header is missing', () => {
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('generated-request-id');

    const req = {
      get: jest.fn().mockReturnValue(undefined)
    } as unknown as Request;
    const res = createResponseMock();
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe('generated-request-id');
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      'generated-request-id'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
