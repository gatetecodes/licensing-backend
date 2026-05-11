jest.mock('config', () => ({
  get: jest.fn(() => 'BNR Licensing Portal')
}));

jest.mock('bunyan', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

import axios from 'axios';
import { log } from '../src/helpers/logger-helper';

describe('logger-helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serializes axios errors and response metadata', () => {
    const axiosError = {
      message: 'Request failed',
      stack: 'trace',
      response: {
        status: 401,
        data: { message: 'Unauthorized' }
      }
    };
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const payload = log({
      event: 'TEST_EVENT',
      response: { status: 200, data: { ok: true } } as any,
      error: axiosError,
      data: { key: 'value' },
      payload: { request: true },
      user: {
        id: 'u-1',
        name: 'User One',
        email: 'user@example.com',
        institution_name: 'Acme',
        password: 'hidden'
      } as any
    });

    expect(payload).toMatchObject({
      event: 'TEST_EVENT',
      response: { status: 200, data: { ok: true } },
      error: {
        status: 401,
        data: { message: 'Unauthorized' },
        message: 'Request failed'
      },
      user: {
        id: 'u-1',
        name: 'User One',
        email: 'user@example.com',
        institution_name: 'Acme'
      }
    });
    expect((payload as any).user.password).toBeUndefined();
  });

  it('serializes non-axios errors with message and stack', () => {
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(false);

    const payload = log({
      error: new Error('Boom')
    });

    expect(payload).toMatchObject({
      error: {
        message: 'Boom'
      }
    });
  });

  it('returns a fallback payload when serialization throws', () => {
    jest.spyOn(axios, 'isAxiosError').mockImplementation(() => {
      throw new Error('Unexpected serializer issue');
    });

    const payload = log({
      error: { message: 'x' }
    });

    expect(payload).toEqual({ message: 'error encountered in log func' });
  });
});
