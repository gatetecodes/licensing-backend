import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {
  roleRepository,
  userRepository,
  userRoleRepository
} from '../database/sequelize';
import { UserCreate, UserStatus } from '../types/user.types';
import { IKeyValuePair } from '../types/shared.types';
import { faker } from '@faker-js/faker';
import User from '../database/models/user.model';
import { RedisKeys } from '../constants/redis-keys';
import { redis } from '../services/redis.service';
import { Includeable, Transaction } from 'sequelize';

export class UserHelper {
  public hashPassword = (password: string): string => {
    const genSalt = bcrypt.genSaltSync(); //Default 10

    const hash = bcrypt.hashSync(password, genSalt);
    return hash;
  };

  public comparePassword = (password: string, hash: string): boolean => {
    return bcrypt.compareSync(password, hash);
  };

  public registerUser = async (user: UserCreate, transaction?: Transaction) => {
    const newUser = await userRepository.create(
      {
        ...user,
        password: user.password,
        status: user.status ?? UserStatus.PENDING_EMAIL_VERIFICATION
      },
      { transaction }
    );
    await newUser.save({ transaction });

    return newUser;
  };

  public generateRandomPassword = (): string => {
    return this.hashPassword(`${faker.internet.password()}-${Date.now()}`);
  };

  public generateStringAuthToken = (): string => {
    const token = crypto.randomBytes(32).toString('hex');
    return token;
  };

  public generateAuthTokenHash = (token: string): string => {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return hash;
  };

  /**
   *
   * @param userId
   * @description get redis key of authenticated user
   */
  public getAuthUserKey = (userId: string): string => {
    const userKey = RedisKeys.AuthUser + ':' + userId;

    return userKey;
  };

  /**
   *
   * @param user
   * @description set authenticated user in redis for 1hour
   */
  public setAuthUserInRedis = async (user: IKeyValuePair) => {
    try {
      const payload = JSON.stringify(user);

      const userKey = this.getAuthUserKey(user.id);

      const time = 60 * 60; // 1h

      await redis.set(userKey, payload, 'EX', time);
      return { success: true };
    } catch {
      return { success: false };
    }
  };

  /**
   *
   * @param userId
   * @description get authenticated user from redis
   */
  public getAuthUserInRedis = async (
    userId: string
  ): Promise<{ success: boolean; user?: User }> => {
    try {
      const userKey = this.getAuthUserKey(userId);

      const get = await redis.get(userKey);

      if (!get) {
        return { success: false };
      }

      const user = JSON.parse(get);

      return { success: true, user };
    } catch {
      return { success: false };
    }
  };

  /**
   *
   * @param object
   * @description get user on Login
   */
  public getLoginUser = async ({ email }: { email?: string }) => {
    const include: Includeable[] = [
      {
        model: userRoleRepository,
        include: [{ model: roleRepository }]
      }
    ];

    const user = await userRepository.findOne({
      where: { email },

      include
    });

    return user;
  };
}
