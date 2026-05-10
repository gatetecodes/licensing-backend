import { Request, Response, NextFunction } from 'express';
import { Session, SessionData } from 'express-session';
import {
  userRepository,
  authTokenRepository,
  userRoleRepository,
  roleRepository,
  sequelize
} from '../../../database/sequelize';
import User from '../../../database/models/user.model';
import { BaseRepository } from './base.repository';
import { redis } from '../../../services/redis.service';
import { Op } from 'sequelize';
import { responseWrapper } from '../../../helpers/response-wrapper';
import {
  IInviteInternalUserBody,
  IResetPasswordBody,
  ILoginBody,
  IRegisterBody,
  UserStatus
} from '../../../types/user.types';
import { logger, log } from '../../../helpers/logger-helper';
import { UserHelper } from '../../../helpers/user-helper';
import { LoggerEvents } from '../../../constants/logger-events';
import httpCodes from '../../../constants/http-codes';
import { AuthTokenTypes } from '../../../types/auth-token.types';
import { sendEmail } from '../../../services/email.service';
import config from 'config';
import { Roles } from '../../../types/role.types';
import {
  getCsrfToken,
  generateCsrfToken
} from '../../../middlewares/csrf.middleware';
import { AuthenticatedRequest } from '../../../types/common.types';
import { RedisKeys } from '../../../constants/redis-keys';

const LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_ATTEMPTS_PER_WINDOW = 8;

type AuthSession = Session &
  Partial<SessionData> & {
    auth?: {
      userId: string;
    };
    csrfToken?: string;
  };

type SessionRequest<Body = any> = AuthenticatedRequest<{}, Body> & {
  session: AuthSession;
};

export class AuthRepository extends BaseRepository<User> {
  private readonly userHelper: UserHelper;

  constructor() {
    super(userRepository);
    this.userHelper = new UserHelper();
  }

  /**
   * @description Register user
   * @param req
   * @param res
   * @param next
   * @returns
   */
  public register = async (
    req: Request<{}, {}, IRegisterBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const payload = req.body;
    logger.info(
      log({
        event: LoggerEvents.AUTH_REGISTER_INIT,
        payload: {
          name: payload.name,
          email: payload.email,
          institution_name: payload.institution_name
        }
      })
    );
    try {
      const existingUser = await userRepository.findOne({
        where: {
          email: payload.email
        }
      });
      if (existingUser) {
        responseWrapper({
          status: httpCodes.BAD_REQUEST,
          res,
          message: 'User already exists'
        });
        return;
      }

      const hashedPassword = this.userHelper.hashPassword(payload.password);
      const verificationToken = this.userHelper.generateStringAuthToken();
      const verificationTokenHash =
        this.userHelper.generateAuthTokenHash(verificationToken);

      const user = await sequelize.transaction(async (transaction) => {
        const applicantRole = await roleRepository.findOne({
          where: { name: Roles.APPLICANT },
          transaction
        });

        if (!applicantRole) {
          throw new Error('Applicant role is not configured');
        }

        const newUser = await this.userHelper.registerUser(
          {
            name: payload.name,
            email: payload.email,
            institution_name: payload.institution_name,
            status: UserStatus.PENDING_EMAIL_VERIFICATION,
            password: hashedPassword
          },
          transaction
        );

        await userRoleRepository.create(
          {
            user_id: newUser.id,
            role_id: applicantRole.id
          },
          { transaction }
        );

        await authTokenRepository.create(
          {
            user_id: newUser.id,
            token_hash: verificationTokenHash,
            token_type: AuthTokenTypes.EMAIL_VERIFICATION,
            expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
            created_at: new Date()
          },
          { transaction }
        );

        return newUser;
      });

      if (!user) {
        responseWrapper({
          status: httpCodes.INTERNAL_SERVER_ERROR,
          res,
          message: 'Failed to register user'
        });
        return;
      }

      //Send verification email to user
      await sendEmail({
        to: user.email,
        subject: 'Verify your email',
        template: 'verify-email',
        context: {
          name: user.name,
          url: `${config.get('app.verifyEmailUri')}?token=${verificationToken}`
        }
      });

      logger.info(
        log({
          event: LoggerEvents.AUTH_REGISTER_SUCCESS,
          payload: {
            name: payload.name,
            email: payload.email,
            institution_name: payload.institution_name
          }
        })
      );
      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'User registered successfully'
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.AUTH_REGISTER_FAILED,
          payload,
          error: error as Error
        })
      );
      return next(error);
    }
  };

  /**
   * @description Invite an internal user and issue a one-time password setup token
   * @param req
   * @param res
   * @param next
   * @returns
   */
  public inviteInternalUser = async (
    req: AuthenticatedRequest<{}, IInviteInternalUserBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const payload = req.body;

    logger.info(
      log({
        event: LoggerEvents.AUTH_INVITE_INTERNAL_USER_INIT,
        payload,
        user: req.user
      })
    );

    try {
      const existingUser = await userRepository.findOne({
        where: { email: payload.email }
      });

      if (existingUser) {
        responseWrapper({
          status: httpCodes.BAD_REQUEST,
          res,
          message: 'User already exists'
        });
        return;
      }

      if (
        payload.role === Roles.APPLICANT ||
        payload.role === Roles.SUPER_ADMIN
      ) {
        responseWrapper({
          status: httpCodes.BAD_REQUEST,
          res,
          message: 'Invalid internal role'
        });
        return;
      }

      const rawPasswordSetupToken = this.userHelper.generateStringAuthToken();
      const passwordSetupTokenHash =
        this.userHelper.generateAuthTokenHash(rawPasswordSetupToken);

      const invitedUser = await sequelize.transaction(async (transaction) => {
        const internalRole = await roleRepository.findOne({
          where: { name: payload.role },
          transaction
        });

        if (!internalRole) {
          throw new Error('Requested role is not configured');
        }

        const newUser = await this.userHelper.registerUser(
          {
            name: payload.name,
            email: payload.email,
            institution_name: 'BNR Internal',
            status: UserStatus.PENDING_PASSWORD_SETUP,
            password: this.userHelper.generateRandomPassword()
          },
          transaction
        );

        await userRoleRepository.create(
          {
            user_id: newUser.id,
            role_id: internalRole.id
          },
          { transaction }
        );

        await authTokenRepository.create(
          {
            user_id: newUser.id,
            token_hash: passwordSetupTokenHash,
            token_type: AuthTokenTypes.PASSWORD_SETUP,
            expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
            created_at: new Date()
          },
          { transaction }
        );

        return newUser;
      });

      await sendEmail({
        to: invitedUser.email,
        subject: 'Set Password',
        template: 'reset-password',
        context: {
          name: invitedUser.name,
          url: `${config.get('app.resetPasswordUri')}?token=${rawPasswordSetupToken}`,
          newAccount: true
        }
      });

      logger.info(
        log({
          event: LoggerEvents.AUTH_INVITE_INTERNAL_USER_SUCCESS,
          payload: {
            email: invitedUser.email,
            role: payload.role
          },
          user: req.user
        })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Internal user invited successfully'
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.AUTH_INVITE_INTERNAL_USER_FAILED,
          payload,
          user: req.user,
          error: error as Error
        })
      );
      return next(error);
    }
  };

  /**
   * @description Verify email
   * @param req
   * @param res
   * @param next
   * @returns
   */
  public verifyEmail = async (
    req: SessionRequest<{ token: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { token } = req.body;
      const tokenHash = this.userHelper.generateAuthTokenHash(token);

      const verificationToken = await authTokenRepository.findOne({
        where: {
          token_hash: tokenHash,
          token_type: AuthTokenTypes.EMAIL_VERIFICATION,
          consumed_at: null,
          expires_at: {
            [Op.gt]: new Date()
          }
        }
      });

      if (!verificationToken) {
        responseWrapper({
          res,
          status: httpCodes.CONFLICT,
          message: 'Invalid token'
        });
        return;
      }

      await sequelize.transaction(async (transaction) => {
        const user = await userRepository.findByPk(verificationToken.user_id, {
          transaction
        });

        if (!user) {
          throw new Error('User not found');
        }

        await user.update(
          {
            status: UserStatus.ACTIVE,
            email_verified_at: new Date()
          },
          { transaction }
        );

        await verificationToken.update(
          {
            consumed_at: new Date()
          },
          { transaction }
        );
      });

      const verifiedUser = await userRepository.findByPk(
        verificationToken.user_id,
        {
          include: [
            {
              model: userRoleRepository,
              include: [{ model: roleRepository }]
            }
          ]
        }
      );

      if (!verifiedUser) {
        responseWrapper({
          res,
          status: httpCodes.NOT_FOUND,
          message: 'User not found'
        });
        return;
      }

      await this.createAuthSession(req, verifiedUser.id);
      await this.userHelper.setAuthUserInRedis(
        this.buildCleanUser(verifiedUser)
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Email verified successfully',
        data: {
          user: this.buildCleanUser(verifiedUser),
          csrfToken: req.session.csrfToken
        }
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.AUTH_VERIFY_EMAIL_FAILED,
          payload: req.body,
          error: error as Error
        })
      );
      return next(error);
    }
  };

  /**
   * @description Get authenticated user
   * @param req
   * @param res
   * @param next
   * @returns
   */

  public getMe = async (
    req: SessionRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        responseWrapper({
          res,
          status: httpCodes.UNAUTHORIZED,
          message: 'UNAUTHORIZED_MUST_LOGIN'
        });
        return;
      }

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Authenticated user fetched successfully',
        data: {
          user: this.buildCleanUser(req.user),
          csrfToken: getCsrfToken(req)
        }
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.AUTH_ME_FAILED,
          user: req.user,
          error: error as Error
        })
      );
      return next(error);
    }
  };

  /**
   * @description Login user
   * @param req
   * @param res
   * @param next
   * @returns
   */

  public login = async (
    req: SessionRequest<ILoginBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const payload = req.body.email;

    logger.info(
      log({
        event: LoggerEvents.AUTH_LOGIN_INIT,
        payload
      })
    );
    try {
      const throttleCheck = await this.checkLoginThrottle(req);
      if (!throttleCheck.allowed) {
        responseWrapper({
          res,
          status: httpCodes.TOO_MANY_REQUESTS,
          message:
            'Too many failed login attempts. Please wait a few minutes before trying again.'
        });
        return;
      }

      const user = await userRepository.findOne({
        where: { email: payload },
        include: [
          {
            model: userRoleRepository,
            include: [{ model: roleRepository }]
          }
        ]
      });

      if (!user) {
        logger.error(
          log({
            event: LoggerEvents.AUTH_LOGIN_FAILED,
            payload,
            error: 'Invalid credentials'
          })
        );
        responseWrapper({
          res,
          status: httpCodes.BAD_REQUEST,
          message: 'Invalid credentials'
        });
        await this.recordFailedLoginAttempt(req);
        return;
      }

      const isValidPassword = this.userHelper.comparePassword(
        req.body.password,
        user.password
      );

      if (!isValidPassword) {
        logger.error(
          log({
            event: LoggerEvents.AUTH_LOGIN_FAILED,
            payload,
            error: 'Invalid credentials'
          })
        );
        responseWrapper({
          res,
          status: httpCodes.BAD_REQUEST,
          message: 'Invalid credentials'
        });
        await this.recordFailedLoginAttempt(req);
        return;
      }

      if (user.status !== UserStatus.ACTIVE) {
        logger.error(
          log({
            event: LoggerEvents.AUTH_LOGIN_FAILED,
            payload,
            error: 'Account is not active'
          })
        );
        responseWrapper({
          res,
          status: httpCodes.UNAUTHORIZED,
          message: 'Account is not active'
        });
        return;
      }

      await this.createAuthSession(req, user.id);
      await this.clearFailedLoginAttempts(req);

      //Set auth user in redis
      await this.userHelper.setAuthUserInRedis(this.buildCleanUser(user));

      logger.info(
        log({
          event: LoggerEvents.AUTH_LOGIN_SUCCESS,
          payload,
          sessionId: req.session.id
        })
      );
      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Login successful',
        data: {
          user: this.buildCleanUser(user),
          csrfToken: req.session.csrfToken
        }
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.AUTH_LOGIN_FAILED,
          payload,
          error: error as Error
        })
      );
      return next(error);
    }
  };

  /**
   * @description Logout user
   * @param req
   * @param res
   * @param next
   * @returns
   */

  public logout = async (
    req: SessionRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    logger.info(log({ event: LoggerEvents.AUTH_LOGOUT_INIT, user: req.user }));
    try {
      if (!req.user?.id) {
        responseWrapper({
          res,
          status: httpCodes.UNAUTHORIZED,
          message: 'Unauthorized'
        });
        return;
      }

      const redisKey = this.userHelper.getAuthUserKey(req.user?.id);

      await redis.del(redisKey).catch((e) => {
        logger.info(
          log({
            event: LoggerEvents.AUTH_LOGOUT_FAILED,
            user: req.user,
            error: e
          })
        );
      });

      await this.destroyAuthSession(req);
      res.clearCookie('bnr.sid');

      logger.info(
        log({ event: LoggerEvents.AUTH_LOGOUT_SUCCESS, user: req.user })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Logged out successfully'
      });
      return;
    } catch (error) {
      logger.error(
        log({ event: LoggerEvents.AUTH_LOGOUT_FAILED, user: req.user })
      );
      return next(error);
    }
  };

  /**
   * @description Request password setup for invited/internal users
   * @param req
   * @param res
   * @param next
   * @returns
   */
  public requestPasswordSetup = async (
    req: Request<{}, {}, { email: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = await userRepository.findOne({
        where: { email: req.body.email },
        include: [
          {
            model: userRoleRepository,
            include: [{ model: roleRepository }]
          }
        ]
      });

      if (!user) {
        responseWrapper({
          status: httpCodes.NOT_FOUND,
          message: 'Account linked to this email could not be found',
          res
        });
        return;
      }

      if (user.status === UserStatus.DISABLED) {
        responseWrapper({
          status: httpCodes.BAD_REQUEST,
          message: 'Account is disabled, please contact support',
          res
        });
        return;
      }

      const assignedRoles =
        user.userRoles
          ?.map((userRole) => userRole.role?.name)
          .filter(Boolean) ?? [];

      if (assignedRoles.includes(Roles.APPLICANT)) {
        responseWrapper({
          status: httpCodes.FORBIDDEN,
          message:
            'Password setup requests are only available for invited internal users',
          res
        });
        return;
      }

      if (user.status !== UserStatus.PENDING_PASSWORD_SETUP) {
        responseWrapper({
          status: httpCodes.CONFLICT,
          message: 'Password setup is only available for invited users',
          res
        });
        return;
      }

      const resetPasswordToken = this.userHelper.generateStringAuthToken();
      const resetPasswordTokenHash =
        this.userHelper.generateAuthTokenHash(resetPasswordToken);

      await authTokenRepository.create({
        user_id: user.id,
        token_hash: resetPasswordTokenHash,
        token_type: AuthTokenTypes.PASSWORD_SETUP,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
        created_at: new Date()
      });

      // send reset password email link
      const emailResult = await sendEmail({
        to: user.email,
        subject: 'Set Password',
        template: 'reset-password',
        context: {
          name: user.name,
          url: `${config.get('app.baseUri.resetPasswordUri')}?token=${resetPasswordToken}`,
          newAccount: true
        }
      });

      if (!emailResult.success) {
        logger.error(
          log({
            event: LoggerEvents.SEND_EMAIL_FAILED,
            payload: req.body,
            userId: user.id,
            userEmail: user.email
          })
        );
      }

      responseWrapper({
        status: httpCodes.OK,
        message: 'Password setup email sent',
        res
      });
      return;
    } catch (error) {
      return next(error);
    }
  };

  /**
   * @description Set password from a one-time password setup token
   * @param req
   * @param res
   * @param next
   * @returns
   */
  public setPassword = async (
    req: AuthenticatedRequest<{}, IResetPasswordBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      logger.info(
        log({ event: LoggerEvents.AUTH_RESET_PASSWORD_INIT, user: req.user })
      );
      const { newPassword, confirmPassword } = req.body;
      const { token } = req.query;

      if (newPassword !== confirmPassword) {
        responseWrapper({
          res,
          status: httpCodes.BAD_REQUEST,
          message: 'Passwords do not match'
        });
        return;
      }

      const tokenHash = this.userHelper.generateAuthTokenHash(token as string);

      const passwordSetupToken = await authTokenRepository.findOne({
        where: {
          token_hash: tokenHash,
          token_type: AuthTokenTypes.PASSWORD_SETUP,
          consumed_at: null,
          expires_at: {
            [Op.gt]: new Date()
          }
        }
      });

      if (!passwordSetupToken) {
        responseWrapper({
          res,
          status: httpCodes.CONFLICT,
          message: 'Invalid token'
        });
        return;
      }

      const hashedPassword = this.userHelper.hashPassword(newPassword);

      await sequelize.transaction(async (transaction) => {
        await userRepository.update(
          {
            password: hashedPassword,
            status: UserStatus.ACTIVE
          },
          {
            where: {
              id: passwordSetupToken.user_id
            },
            transaction
          }
        );

        await passwordSetupToken.update(
          {
            consumed_at: new Date()
          },
          { transaction }
        );
      });

      logger.info(
        log({ event: LoggerEvents.AUTH_RESET_PASSWORD_SUCCESS, user: req.user })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Password set successfully'
      });
      return;
    } catch (error) {
      return next(error);
    }
  };

  public getCsrfToken = async (
    req: SessionRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'CSRF token fetched successfully',
        data: {
          csrfToken: getCsrfToken(req)
        }
      });
      return;
    } catch (error) {
      return next(error);
    }
  };

  private readonly buildCleanUser = (user: User) => {
    const userRole = user.userRoles?.[0]?.role;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      institution_name: user.institution_name,
      role: userRole
        ? {
            id: userRole.id,
            name: userRole.name
          }
        : null
    };
  };

  private readonly createAuthSession = async (
    req: SessionRequest,
    userId: string
  ): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) {
          reject(error);
          return;
        }

        req.session.auth = { userId };
        req.session.csrfToken = generateCsrfToken();
        req.session.save((saveError) => {
          if (saveError) {
            reject(saveError);
            return;
          }

          resolve();
        });
      });
    });
  };

  private readonly destroyAuthSession = async (
    req: SessionRequest
  ): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  };

  /**
   * @description Check if login is throttled
   * @param req
   * @returns
   */

  private readonly checkLoginThrottle = async (
    req: SessionRequest<ILoginBody>
  ): Promise<{ allowed: boolean }> => {
    try {
      const emailKey = RedisKeys.AuthLoginAttemptsEmail(
        req.body.email.trim().toLowerCase()
      );
      const ipKey = RedisKeys.AuthLoginAttemptsIp(req.ip ?? 'unknown');

      const [emailAttempts, ipAttempts] = await Promise.all([
        redis.get(emailKey),
        redis.get(ipKey)
      ]);

      const emailCount = Number(emailAttempts ?? 0);
      const ipCount = Number(ipAttempts ?? 0);

      return {
        allowed:
          emailCount < MAX_LOGIN_ATTEMPTS_PER_WINDOW &&
          ipCount < MAX_LOGIN_ATTEMPTS_PER_WINDOW
      };
    } catch {
      return { allowed: true };
    }
  };


  /**
   * @description Record failed login attempt
   * @param req
   * @returns
   */

  private readonly recordFailedLoginAttempt = async (
    req: SessionRequest<ILoginBody>
  ): Promise<void> => {
    try {
      const emailKey = RedisKeys.AuthLoginAttemptsEmail(
        req.body.email.trim().toLowerCase()
      );
      const ipKey = RedisKeys.AuthLoginAttemptsIp(req.ip ?? 'unknown');

      const [emailAttempts, ipAttempts] = await Promise.all([
        redis.incr(emailKey),
        redis.incr(ipKey)
      ]);

      if (emailAttempts === 1) {
        await redis.expire(emailKey, LOGIN_ATTEMPT_WINDOW_SECONDS);
      }

      if (ipAttempts === 1) {
        await redis.expire(ipKey, LOGIN_ATTEMPT_WINDOW_SECONDS);
      }
    } catch {
      return;
    }
  };

  /**
   * @description Clear failed login attempts
   * @param req
   * @returns
   */

  private readonly clearFailedLoginAttempts = async (
    req: SessionRequest<ILoginBody>
  ): Promise<void> => {
    try {
      const emailKey = RedisKeys.AuthLoginAttemptsEmail(
        req.body.email.trim().toLowerCase()
      );
      const ipKey = RedisKeys.AuthLoginAttemptsIp(req.ip ?? 'unknown');

      await redis.del(emailKey, ipKey);
    } catch {
      return;
    }
  };
}
