import * as dotenv from 'dotenv';
dotenv.config();
import config from 'config';
import IoRedis from 'ioredis';

const port = Number(config.get('app.redis.port'));

const host: string = config.get('app.redis.host');

const password: string | undefined = config.has('app.redis.password')
  ? config.get('app.redis.password')
  : undefined;

export const redis = new IoRedis({
  host,
  port,
  password,
  maxRetriesPerRequest: null,
  lazyConnect: true
});

export class RedisHelper {
  public getItem = async (key: string) => {
    return redis.get(key);
  };

  public setItem = async (values: {
    key: string;
    value: string | number;
    seconds?: number;
  }) => {
    const time = values.seconds ?? 1800;
    return redis.set(values.key, values.value, 'EX', time);
  };

  public setExpiringItem = async (values: {
    key: string;
    value: string | number;
    expiry: number;
  }) => {
    return redis.set(values.key, values.value, 'EX', values.expiry);
  };

  public deleteItem = async (key: string) => {
    return redis.del(key);
  };

  public getRedis() {
    return redis;
  }

  /**
   *
   * @param redisKey
   * @description get item from redis
   */
  getFromRedis = async (
    redisKey: string
  ): Promise<{ success: boolean; data?: string }> => {
    try {
      const find = await redis.get(redisKey);

      if (!find) {
        return { success: false };
      }

      return { success: true, data: find };
    } catch {
      return { success: false };
    }
  };

  /**
   *
   * @param redisKey
   * @description remove item from redis
   */
  removeFromRedis = async (redisKey: string): Promise<{ success: boolean }> => {
    try {
      await redis.del(redisKey);

      return { success: true };
    } catch {
      return { success: false };
    }
  };

  /**
   *
   * @param redisKey
   * @param expirationTime
   * @param value
   * @description set item in redis
   */
  setInRedis = async (args: {
    redisKey: string;
    expirationTime: number;
    value: string;
  }): Promise<boolean> => {
    const { redisKey, expirationTime, value } = args;
    try {
      await redis.set(redisKey, value, 'EX', expirationTime);

      return true;
    } catch {
      return false;
    }
  };
}
export default RedisHelper;
