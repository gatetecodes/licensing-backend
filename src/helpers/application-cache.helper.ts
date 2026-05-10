import { redis } from '../services/redis.service';
import { RedisKeys, RedisPrefix } from '../constants/redis-keys';
import { ApplicationStates } from '../types/application.types';
import { RoleType } from '../types/role.types';

const CACHE_TTL_SECONDS = {
  list: 60,
  detail: 30,
  count: 30
};

const keyPrefixes = {
  list: `${RedisPrefix}applications:list:`,
  count: `${RedisPrefix}applications:count:`
};

const toFilterKey = (currentState?: string): string => currentState ?? 'all';
export const getInternalCacheUserId = (): string => 'internal';

export const buildApplicationListCacheKey = (
  role: RoleType,
  userId: string,
  currentState?: string
): string =>
  RedisKeys.ApplicationsList(role, userId, toFilterKey(currentState));

export const buildApplicationCountCacheKey = (
  role: RoleType,
  userId: string,
  currentState?: string
): string =>
  RedisKeys.ApplicationsCount(role, userId, toFilterKey(currentState));

export const buildApplicationDetailCacheKey = (applicationId: string): string =>
  RedisKeys.ApplicationDetails(applicationId);

export const getApplicationsListCache = async (
  key: string
): Promise<unknown[] | null> => {
  try {
    const cached = await redis.get(key);
    if (!cached) {
      return null;
    }

    return JSON.parse(cached) as unknown[];
  } catch {
    return null;
  }
};

export const setApplicationsListCache = async (
  key: string,
  items: unknown[]
): Promise<void> => {
  try {
    await redis.set(key, JSON.stringify(items), 'EX', CACHE_TTL_SECONDS.list);
  } catch {
    return;
  }
};

export const getApplicationCountCache = async (
  key: string
): Promise<number | null> => {
  try {
    const cached = await redis.get(key);
    if (cached === null) {
      return null;
    }

    const parsed = Number(cached);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
};

export const setApplicationCountCache = async (
  key: string,
  count: number
): Promise<void> => {
  try {
    await redis.set(key, String(count), 'EX', CACHE_TTL_SECONDS.count);
  } catch {
    return;
  }
};

export const getApplicationDetailCache = async (
  key: string
): Promise<unknown | null> => {
  try {
    const cached = await redis.get(key);
    if (!cached) {
      return null;
    }

    return JSON.parse(cached);
  } catch {
    return null;
  }
};

export const setApplicationDetailCache = async (
  key: string,
  application: unknown
): Promise<void> => {
  try {
    await redis.set(
      key,
      JSON.stringify(application),
      'EX',
      CACHE_TTL_SECONDS.detail
    );
  } catch {
    return;
  }
};

const deleteKeysByPrefix = async (prefix: string): Promise<void> => {
  try {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        '100'
      );
      cursor = nextCursor;

      if (keys.length) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    return;
  }
};

export const invalidateApplicationListAndCountCaches =
  async (): Promise<void> => {
    await deleteKeysByPrefix(keyPrefixes.list);
    await deleteKeysByPrefix(keyPrefixes.count);
  };

export const invalidateApplicationReadCaches = async (
  applicationId: string
): Promise<void> => {
  try {
    await redis.del(buildApplicationDetailCacheKey(applicationId));
  } catch {
    // ignore error for best effort
  }
  await invalidateApplicationListAndCountCaches();
};

export const getListStateForInternalUsers = (
  currentState?: string
): string | undefined => {
  if (currentState === ApplicationStates.DRAFT) {
    return undefined;
  }
  return currentState;
};
