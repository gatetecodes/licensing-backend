import path from 'path';
import fs from 'fs';
import bunyan from 'bunyan';
import config from 'config';
import { LoggerEvents } from '../constants/logger-events';
import axios, { AxiosResponse } from 'axios';
import { pick } from 'lodash';
import User from '../database/models/user.model';

const LOGS_DIR = path.join(__dirname, '../../logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export const logger = bunyan.createLogger({
  name: config.get('app.name'),
  src: true,
  streams: [
    {
      level: 'debug',
      stream: process.stdout
    },
    { level: 'info', path: path.join(LOGS_DIR, 'info.log') }
  ]
});

/**
 * @description used on user audit / track user activities
 *
 */
export const auditLogger = bunyan.createLogger({
  name: config.get('app.name'),
  src: true,
  streams: [
    {
      level: 'debug',
      stream: process.stdout
    },
    {
      level: 'info',
      path: path.join(LOGS_DIR, 'info-audit.log')
    }
  ]
});

export const log = <Payload>({
  response,
  event,
  error,
  data,
  payload,
  user,
  ...other
}: {
  event?: string | typeof LoggerEvents;
  response?: AxiosResponse & { [key: string]: any };
  error?: any;
  data?: any;
  payload?: Payload;
  user?: User;
  [key: string]: any;
}) => {
  try {
    return {
      event,
      data,

      payload,

      response: response
        ? {
            status: response?.status,
            data: response?.data
          }
        : undefined,

      error: error
        ? axios.isAxiosError(error)
          ? {
              status: error?.response?.status,
              data: error?.response?.data,
              stack: error?.stack,
              message: error?.message
            }
          : { message: error?.message, stack: error?.stack }
        : undefined,
      user: user
        ? pick(user, ['id', 'name', 'email', 'institution_name'])
        : undefined,
      ...other
    };
  } catch {
    return { message: 'error encountered in log func' };
  }
};
