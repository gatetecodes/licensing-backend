import { AuthenticatedRequest } from '@src/types/common.types';
import { RoleType } from '@src/types/role.types';
import UserRoleModel from '@src/database/models/user-role.model';

export const getUserRoleNames = (req: AuthenticatedRequest): RoleType[] =>
  req.user?.userRoles
    ?.map((userRole: UserRoleModel) => userRole.role?.name)
    .filter((role): role is RoleType => role !== undefined) ?? [];

export const getPrimaryRole = (req: AuthenticatedRequest): RoleType | undefined =>
  getUserRoleNames(req)[0];
