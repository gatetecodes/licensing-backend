import { Request } from 'express';
import type UserModel from '@src/database/models/user.model';

export type AuthenticatedRequest<
  Params = Record<string, string | undefined>,
  Body = any,
  Query = any
> = Request<Params, {}, Body, Query> & {
  user?: UserModel;
  requestId?: string;
};

export type SessionRequest = Request & {
  session?: {
    auth?: {
      userId?: string;
    };
  };
};
