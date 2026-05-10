import { ResponseWrapper } from '../types/shared.types';
import moment from 'moment';
import { Response } from 'express';

export const responseWrapper = <Data>({
  res,
  message,
  status,
  ...rest
}: ResponseWrapper<Data>): Response =>
  res.status(status).json({
    status,
    message,
    ...rest,
    timestamp: moment().format('YYYY-MM-DD h:mm:ss a').toUpperCase()
  });

export default responseWrapper;
