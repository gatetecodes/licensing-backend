import { NextFunction, Response } from 'express';
import { BaseRepository } from './base.repository';
import UserModel from '../../../database/models/user.model';
import {
  roleRepository,
  userRepository,
  userRoleRepository
} from '../../../database/sequelize';
import { logger, log } from '../../../helpers/logger-helper';
import { LoggerEvents } from '../../../constants/logger-events';
import httpCodes from '../../../constants/http-codes';
import { responseWrapper } from '../../../helpers/response-wrapper';
import {
  IInternalListUsersQuery,
  IInternalUpdateUserStatusBody,
  UserStatus
} from '../../../types/user.types';
import { AuthenticatedRequest } from '../../../types/common.types';
import { UserHelper } from '../../../helpers/user-helper';
import { redis } from '../../../services/redis.service';
import { INTERNAL_VIEWER_ROLES, RoleType } from '../../../types/role.types';
import { invalidateApplicationListAndCountCaches } from '../../../helpers/application-cache.helper';

const getUserRoleNames = (user: UserModel) =>
  user.userRoles
    ?.map((userRole) => userRole.role?.name)
    .filter((role): role is RoleType => role !== undefined) ?? [];

const sanitizeInternalUser = (user: UserModel) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  institution_name: user.institution_name,
  status: user.status,
  email_verified_at: user.email_verified_at ?? null,
  roles: getUserRoleNames(user),
  created_at: user.created_at,
  updated_at: user.updated_at
});

export class AdminRepository extends BaseRepository<UserModel> {
  private readonly userHelper: UserHelper;

  constructor() {
    super(userRepository);
    this.userHelper = new UserHelper();
  }

  public getInternalUsers = async (
    req: AuthenticatedRequest<
      Record<string, never>,
      Record<string, never>,
      IInternalListUsersQuery
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    logger.info(
      log({
        event: LoggerEvents.INTERNAL_USERS_LIST_INIT,
        payload: req.query,
        user: req.user,
        requestId: req.requestId
      })
    );

    try {
      const users = await userRepository.findAll({
        include: [
          {
            model: userRoleRepository,
            include: [{ model: roleRepository }]
          }
        ],
        order: [['updated_at', 'DESC']]
      });

      const isInternalManagedUser = (user: UserModel): boolean =>
        getUserRoleNames(user).some((role) =>
          INTERNAL_VIEWER_ROLES.includes(role)
        );

      const items = users
        .filter(isInternalManagedUser)
        .filter((user) =>
          req.query.status ? user.status === req.query.status : true
        )
        .filter((user) =>
          req.query.role
            ? user.userRoles?.some(
                (userRole) => userRole.role?.name === req.query.role
              )
            : true
        )
        .map((user) => sanitizeInternalUser(user));

      logger.info(
        log({
          event: LoggerEvents.INTERNAL_USERS_LIST_SUCCESS,
          data: { count: items.length },
          user: req.user,
          requestId: req.requestId
        })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'Admin users fetched successfully',
        data: {
          items
        }
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.INTERNAL_USERS_LIST_FAILED,
          payload: req.query,
          user: req.user,
          requestId: req.requestId,
          error
        })
      );
      return next(error);
    }
  };

  public updateInternalUserStatus = async (
    req: AuthenticatedRequest<{ id: string }, IInternalUpdateUserStatusBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    logger.info(
      log({
        event: LoggerEvents.INTERNAL_USER_STATUS_UPDATE_INIT,
        payload: {
          id: req.params.id,
          status: req.body.status
        },
        user: req.user,
        requestId: req.requestId
      })
    );

    try {
      const targetUser = await userRepository.findByPk(req.params.id, {
        include: [
          {
            model: userRoleRepository,
            include: [{ model: roleRepository }]
          }
        ]
      });

      if (!targetUser) {
        responseWrapper({
          res,
          status: httpCodes.NOT_FOUND,
          message: 'User not found'
        });
        return;
      }

      if (
        !getUserRoleNames(targetUser).some((role) =>
          INTERNAL_VIEWER_ROLES.includes(role)
        )
      ) {
        responseWrapper({
          res,
          status: httpCodes.UNPROCESSABLE_ENTITY,
          message: 'Only internal users can be managed from this endpoint'
        });
        return;
      }

      if (req.user?.id === targetUser.id) {
        responseWrapper({
          res,
          status: httpCodes.UNPROCESSABLE_ENTITY,
          message: 'You cannot change your own account status'
        });
        return;
      }

      targetUser.status = req.body.status;
      await targetUser.save();

      if (req.body.status === UserStatus.DISABLED) {
        const redisKey = this.userHelper.getAuthUserKey(targetUser.id);
        await redis.del(redisKey);
      }

      await invalidateApplicationListAndCountCaches();

      logger.info(
        log({
          event: LoggerEvents.INTERNAL_USER_STATUS_UPDATE_SUCCESS,
          data: {
            id: targetUser.id,
            status: targetUser.status
          },
          user: req.user,
          requestId: req.requestId
        })
      );

      responseWrapper({
        res,
        status: httpCodes.OK,
        message: 'User status updated successfully',
        data: {
          user: sanitizeInternalUser(targetUser)
        }
      });
      return;
    } catch (error) {
      logger.error(
        log({
          event: LoggerEvents.INTERNAL_USER_STATUS_UPDATE_FAILED,
          payload: {
            id: req.params.id,
            status: req.body.status
          },
          user: req.user,
          requestId: req.requestId,
          error
        })
      );
      return next(error);
    }
  };
}

export default AdminRepository;
