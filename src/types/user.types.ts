import { RoleType } from './role.types';

export const UserStatus = {
  PENDING_EMAIL_VERIFICATION: 'PENDING_EMAIL_VERIFICATION',
  PENDING_PASSWORD_SETUP: 'PENDING_PASSWORD_SETUP',
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED'
} as const;

export type UserStatusType = (typeof UserStatus)[keyof typeof UserStatus];

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  institution_name: string;
  email_verified_at: Date;
  status: UserStatusType;
  created_at: Date;
  updated_at: Date;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  institution_name: string;
  status: UserStatusType;
}

export interface IResetPasswordBody {
  newPassword: string;
  confirmPassword: string;
}

export interface ILoginBody {
  email: string;
  password: string;
}

export interface IRegisterBody  extends ILoginBody {
    name: string;
    institution_name: string;
}

export interface IInviteInternalUserBody {
  name: string;
  email: string;
  role: RoleType;
}

export interface IInternalListUsersQuery {
  status?: UserStatusType;
  role?: RoleType;
}

export interface IInternalUpdateUserStatusBody {
  status: Extract<UserStatusType, 'ACTIVE' | 'DISABLED'>;
}
