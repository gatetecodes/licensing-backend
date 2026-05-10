import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { Session, SessionData } from 'express-session';
import httpCodes from '../constants/http-codes';
import { responseWrapper } from '../helpers/response-wrapper';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * @description Check if the tokens match
 * @param sessionToken - The session token
 * @param requestToken - The request token
 * @returns - True if the tokens match, false otherwise
 */
const tokensMatch = (sessionToken: string, requestToken: string): boolean => {
  const sessionBuffer = Buffer.from(sessionToken, 'utf8');
  const requestBuffer = Buffer.from(requestToken, 'utf8');

  if (sessionBuffer.length !== requestBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sessionBuffer, requestBuffer);
};

export const generateCsrfToken = (): string =>
  crypto.randomBytes(32).toString('hex');

type CsrfSession = Session &
  Partial<SessionData> & {
    csrfToken?: string;
  };

/**
 * @description Get the CSRF token from the session
 * @param req - The request object
 * @returns - The CSRF token
 */
export const getCsrfToken = (req: Request): string => {
  const session = req.session as CsrfSession;

  if (!session.csrfToken) {
    session.csrfToken = generateCsrfToken();
  }

  return session.csrfToken;
};

export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const session = req.session as CsrfSession | undefined;
  const sessionToken = session?.csrfToken;
  const requestToken =
    req.get(CSRF_HEADER_NAME) || req.get('csrf-token') || req.body?._csrf;

  if (!sessionToken || typeof requestToken !== 'string') {
    responseWrapper({
      res,
      status: httpCodes.FORBIDDEN,
      message: 'Invalid or missing CSRF token'
    });
    return;
  }

  if (!tokensMatch(sessionToken, requestToken)) {
    responseWrapper({
      res,
      status: httpCodes.FORBIDDEN,
      message: 'Invalid or missing CSRF token'
    });
    return;
  }

  next();
};
