import { Request, Response, NextFunction } from 'express';
import httpCode from '../../../constants/http-codes';
import responseWrapper from '../../../helpers/response-wrapper';
import { UserHelper } from '../../../helpers/user-helper';
import {
  authTokenRepository,
  roleRepository,
  userRepository,
  userRoleRepository
} from '../../../database/sequelize';
import { Op } from 'sequelize';
import { RoleType } from '../../../types/role.types';
import { UserStatus } from '../../../types/user.types';
import { getUserRoleNames } from '../../../helpers/auth-helper';
import { AuthenticatedRequest, SessionRequest } from '../../../types/common.types';

/**
 * @description Check if the user is authenticated
 * @param req - The request object
 * @param res - The response object
 * @param next - The next function
 * @returns - The next function or an error
 */
export const isAuth = async (
  req: SessionRequest & AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userId = req.session?.auth?.userId;

    if (!userId) {
      return responseWrapper({
        res,
        status: httpCode.UNAUTHORIZED,
        message: 'UNAUTHORIZED_MUST_LOGIN'
      });
    }

    const user = await userRepository.findByPk(userId, {
      include: [
        {
          model: userRoleRepository,
          include: [{ model: roleRepository }]
        }
      ]
    });

    if (!user) {
      return responseWrapper({
        res,
        status: httpCode.UNAUTHORIZED,
        message: 'UNAUTHORIZED_MUST_LOGIN'
      });
    }

    if (user.status === UserStatus.DISABLED) {
      return responseWrapper({
        res,
        status: httpCode.UNAUTHORIZED,
        message: 'Account is disabled'
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      return responseWrapper({
        res,
        status: httpCode.UNAUTHORIZED,
        message: 'Account is not active'
      });
    }

    req.user = user;

    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * @description Check if the user has the required roles
 * @param allowedRoles - The allowed roles
 * @returns - The next function or an error
 */

export const requireRoles =
  (...allowedRoles: RoleType[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return responseWrapper({
        res,
        status: httpCode.UNAUTHORIZED,
        message: 'UNAUTHORIZED_MUST_LOGIN'
      });
    }

    const userRoles = getUserRoleNames(req);
    const isAllowed = allowedRoles.some((role) => userRoles.includes(role));

    if (!isAllowed) {
      return responseWrapper({
        res,
        status: httpCode.FORBIDDEN,
        message: 'FORBIDDEN'
      });
    }

    return next();
  };

/**
 * @description Verify the token
 * @param req - The request object
 * @param res - The response object
 * @param next - The next function
 * @returns - The next function or an error
 */

export const verifyToken = async (
  req: Request<{ token?: string }, any, any, { token?: string }>,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const userHelper = new UserHelper();

    const token = req.query.token || req.params.token;

    if (!token) {
      return responseWrapper({
        res,
        status: httpCode.CONFLICT,
        message: 'Invalid token'
      });
    }

    const tokenHash = userHelper.generateAuthTokenHash(token);

    const authToken = await authTokenRepository.findOne({
      where: {
        token_hash: tokenHash,
        consumed_at: null,
        expires_at: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!authToken) {
      return responseWrapper({
        status: httpCode.CONFLICT,
        res,
        message: 'Invalid token'
      });
    }

    return next();
  } catch (error: any) {
    return next(error);
  }
};
