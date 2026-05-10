import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

type RequestWithId = Request & {
  requestId?: string;
};

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const incomingRequestId = req.get('x-request-id');
  const requestId = incomingRequestId?.trim() || crypto.randomUUID();

  (req as RequestWithId).requestId = requestId;
  res.setHeader('x-request-id', requestId);

  next();
};

export default requestIdMiddleware;
