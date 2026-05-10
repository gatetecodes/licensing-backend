import { LoggerEvents } from '../constants/logger-events';
import { log, logger } from '../helpers/logger-helper';
import { redis } from '../services/redis.service';

/**
 * Helper function to handle logging errors consistently
 */
const logError = (event: string, err: any) => {
  logger.info(
    log({
      event,
      message: err?.message,
      stack: err?.stack,
      code: err?.code || 'UNKNOWN_ERROR'
    })
  );
};

/**
 * Helper function to log successful events
 */
const logEvent = (event: string, message: string) => {
  logger.info(
    log({
      event,
      message
    })
  );
};

export const listenToRedisEvent = () => {
  /**
   * redis connection events / hooks
   */
  redis.on('error', (err) => {
    logError(LoggerEvents.REDIS_CONNECT_ERROR, err);
  });

  redis.on('connect', () => {
    try {
      logEvent(LoggerEvents.REDIS_CONNECT, 'redis connected');
    } catch (err: any) {
      logError(LoggerEvents.REDIS_CONNECT_FAILED, err);
    }
  });

  redis.on('end', () => {
    try {
      // If necessary to quit manually, ensure it's done only when needed
      redis.quit();
      logEvent(LoggerEvents.REDIS_QUIT, 'Redis connection closed');
    } catch (err: any) {
      logError(LoggerEvents.REDIS_QUIT_FAILED, err);
    }
  });
};
