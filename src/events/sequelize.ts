import { log, logger } from '../helpers/logger-helper';
import { LoggerEvents } from '../constants/logger-events';
import config from 'config';
import { sequelize } from '../database/sequelize';

const logEvent = (event: string, message: string, err: any = null) => {
  if (err) {
    logger.info(
      log({
        event,
        message: err?.message,
        stack: err?.stack,
        code: err?.code || 'UNKNOWN_ERROR'
      })
    );
  } else {
    logger.info(log({ event, message }));
  }
};

export const listenToSequelizeEvent = () => {
  const nodeEnv = config.get('node_env');

  if (nodeEnv === 'development') {
    return;
  }
  /**
   * sequelize manage connection pool
   */
  const acquireAttempts = new WeakMap();

  sequelize.addHook('beforePoolAcquire', (options) => {
    try {
      acquireAttempts.set(options, Date.now());
    } catch (err: any) {
      logEvent(
        LoggerEvents.DB_BEFORE_POOL_ACQUIRE_FAILURE,
        'Failed to track acquire attempt',
        err
      );
    }
  });

  sequelize.addHook('afterPoolAcquire', (_connection, options) => {
    try {
      const elapsedTime = Date.now() - acquireAttempts.get(options);

      const message = `connection acquired in ${elapsedTime}ms`;

      logEvent(LoggerEvents.DB_AFTER_POOL_ACQUIRE, message);
    } catch (err: any) {
      logEvent(
        LoggerEvents.DB_AFTER_POOL_ACQUIRE_FAILURE,
        'Failed to log acquire time',
        err
      );
    }
  });

  /**
   * Track When New DB connection Initiated
   */
  sequelize.addHook('afterConnect', (_connection, options) => {
    try {
      logEvent(
        LoggerEvents.DB_CONNECTION_INIT_SUCCESS,
        `Database connection initiated to host ${options?.host}`
      );
    } catch (err: any) {
      logEvent(
        LoggerEvents.DB_CONNECTION_INIT_FAILURE,
        'Failed to log DB connection initiation',
        err
      );
    }
  });

  /**
   * Track when DB is disconnected from host
   */
  sequelize.addHook('afterDisconnect', (connection: any) => {
    try {
      const host = connection?.host;

      logEvent(
        LoggerEvents.DB_CONNECTION_DISCONNECTED,
        `Database disconnected from host ${host}`
      );
    } catch (err: any) {
      logEvent(
        LoggerEvents.DB_CONNECTION_DISCONNECTED_FAILURE,
        'Failed to log DB disconnection',
        err
      );
    }
  });
};
