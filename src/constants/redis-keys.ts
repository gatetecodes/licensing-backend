export const RedisPrefix = 'bnrlic_';

export const RedisKeys = {
  /**
   * Authenticated user
   */
  AuthUser: (userId: string) => `${RedisPrefix}auth:user:${userId}`,

  /**
   * Applications
   */
  ApplicationsList: (role: string, userId: string, filterKey = 'all') =>
    `${RedisPrefix}applications:list:${role}:${userId}:${filterKey}`,

  /**
   * Application details
   */
  ApplicationDetails: (applicationId: string) =>
    `${RedisPrefix}application:details:${applicationId}`,

  /**
   * Applications count
   */
  ApplicationsCount: (role: string, userId: string, filterKey = 'all') =>
    `${RedisPrefix}applications:count:${role}:${userId}:${filterKey}`,

  /**
   * Auth login throttling
   */
  AuthLoginAttemptsEmail: (email: string) =>
    `${RedisPrefix}auth:login:attempts:email:${email}`,
  AuthLoginAttemptsIp: (ipAddress: string) =>
    `${RedisPrefix}auth:login:attempts:ip:${ipAddress}`
} as const;

export type RedisKey = (typeof RedisKeys)[keyof typeof RedisKeys];
