import { NextFunction, Request, Response } from 'express';
import {
  CSRF_HEADER_NAME,
  csrfProtection,
  getCsrfToken
} from '../src/middlewares/csrf.middleware';

type RequestMockInput = {
  method?: string;
  headers?: Record<string, unknown>;
  body?: Record<string, unknown>;
  session?: Record<string, unknown>;
};

const createRequestMock = (input: RequestMockInput = {}): Request => {
  const headers = Object.fromEntries(
    Object.entries(input.headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value
    ])
  );

  return {
    method: input.method ?? 'POST',
    body: input.body ?? {},
    session: input.session ?? {},
    get: (name: string) => headers[name.toLowerCase()] as string | undefined
  } as unknown as Request;
};

const createResponseMock = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('csrf middleware', () => {
  it('generates and stores a csrf token when missing from session', () => {
    const req = createRequestMock({ session: {} });

    const token = getCsrfToken(req);

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect((req.session as { csrfToken?: string }).csrfToken).toBe(token);
  });

  it('returns existing session csrf token', () => {
    const req = createRequestMock({ session: { csrfToken: 'existing-token' } });

    const token = getCsrfToken(req);

    expect(token).toBe('existing-token');
  });

  it('allows safe methods without csrf validation', () => {
    const req = createRequestMock({ method: 'GET' });
    const res = createResponseMock();
    const next = jest.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns forbidden when csrf token is missing', () => {
    const req = createRequestMock({ method: 'POST', session: {} });
    const res = createResponseMock();
    const next = jest.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns forbidden when request has no session object', () => {
    const req = createRequestMock({
      method: 'POST',
      headers: { [CSRF_HEADER_NAME]: 'token-without-session' }
    });
    (req as unknown as { session?: Record<string, unknown> }).session = undefined;
    const res = createResponseMock();
    const next = jest.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns forbidden when csrf token does not match', () => {
    const req = createRequestMock({
      method: 'PATCH',
      session: { csrfToken: 'session-token' },
      headers: { [CSRF_HEADER_NAME]: 'request-token' }
    });
    const res = createResponseMock();
    const next = jest.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns forbidden when token lengths differ', () => {
    const req = createRequestMock({
      method: 'PATCH',
      session: { csrfToken: 'short' },
      headers: { [CSRF_HEADER_NAME]: 'very-long-token-value' }
    });
    const res = createResponseMock();
    const next = jest.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('accepts matching csrf token from x-csrf-token header', () => {
    const req = createRequestMock({
      method: 'PUT',
      session: { csrfToken: 'matching-token' },
      headers: { [CSRF_HEADER_NAME]: 'matching-token' }
    });
    const res = createResponseMock();
    const next = jest.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('accepts matching csrf token from request body fallback', () => {
    const req = createRequestMock({
      method: 'DELETE',
      session: { csrfToken: 'body-token' },
      body: { _csrf: 'body-token' }
    });
    const res = createResponseMock();
    const next = jest.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('accepts matching csrf token from csrf-token header fallback', () => {
    const req = createRequestMock({
      method: 'POST',
      session: { csrfToken: 'header-fallback-token' },
      headers: { 'csrf-token': 'header-fallback-token' }
    });
    const res = createResponseMock();
    const next = jest.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
