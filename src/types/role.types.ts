export const Roles = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  APPLICANT: 'APPLICANT',
  REVIEWER: 'REVIEWER',
  APPROVER: 'APPROVER'
} as const;

export type RoleType = (typeof Roles)[keyof typeof Roles];

export interface Role {
  id: string;
  name: RoleType;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface RoleCreate {
  name: RoleType;
  description?: string;
}

export const INTERNAL_VIEWER_ROLES: RoleType[] = [
  Roles.REVIEWER,
  Roles.APPROVER,
  Roles.ADMIN,
  Roles.SUPER_ADMIN
];
